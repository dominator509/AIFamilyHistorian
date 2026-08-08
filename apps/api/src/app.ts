import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { healthStatusSchema } from '@family-historian/contracts';
import {
  FixedWindowRateLimiter,
  parseAuthorizationHeader,
  type SessionRevocationStore,
  type SessionStore,
  type RateLimiter,
  verifySessionToken,
} from '@family-historian/auth';
import type { ArchiveService } from './archive-service.js';
import { ApiProblem, sendProblem } from './problems.js';
import { registerV1Routes } from './routes.js';

export interface AppDependencies {
  service: ArchiveService;
  sessionSecret: string;
  rateLimiter?: RateLimiter;
  sessionRevocationStore?: SessionRevocationStore;
  sessionStore?: SessionStore;
  sessionMembershipChecker?: (
    context: { organizationId: string; familyArchiveId: string },
    userId: string,
  ) => Promise<boolean>;
  corsAllowedOrigins?: readonly string[];
  stripeWebhookSecret?: string;
}

export async function createApp(dependencies?: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
    },
    bodyLimit: 1_048_576,
    requestIdHeader: 'x-request-id',
  });

  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    const rawBody = String(body);
    (request as FastifyRequest & { rawBody?: string }).rawBody = rawBody;
    try {
      done(null, JSON.parse(rawBody));
    } catch {
      done(new Error('invalid JSON'));
    }
  });

  await app.register(helmet, { global: true });
  const corsOrigins = dependencies?.corsAllowedOrigins ?? [];
  await app.register(cors, {
    origin: corsOrigins.length > 0 ? [...corsOrigins] : false,
    credentials: false,
  });
  app.setErrorHandler((error, request, reply) => sendProblem(error, request, reply));
  const rateLimiter =
    dependencies?.rateLimiter ??
    new FixedWindowRateLimiter({ limit: 120, windowMilliseconds: 60_000, maxKeys: 10_000 });
  app.addHook('onRequest', async (request, reply) => {
    let decision: Awaited<ReturnType<RateLimiter['consume']>>;
    try {
      decision = await rateLimiter.consume(request.ip);
      const authorization = request.headers.authorization;
      if (authorization) {
        let session: ReturnType<typeof verifySessionToken> | undefined;
        try {
          session = verifySessionToken(
            dependencies?.sessionSecret ?? '',
            parseAuthorizationHeader(authorization),
          );
        } catch {
          // Invalid bearer tokens remain an auth failure at the route boundary.
        }
        if (session) {
          if (dependencies?.sessionStore && session.sessionId) {
            const stored = await dependencies.sessionStore.find(session.sessionId);
            if (stored && (stored.revokedAt || stored.expiresAt <= Math.floor(Date.now() / 1000)))
              throw new ApiProblem('AUTH_REQUIRED', 'Session is no longer active');
          }
          if (
            dependencies?.sessionRevocationStore &&
            session.sessionId &&
            (await dependencies.sessionRevocationStore.isRevoked(session.sessionId))
          )
            throw new ApiProblem('AUTH_REQUIRED', 'Session has been revoked');
          const principalDecision = await rateLimiter.consume(
            `principal:${session.organizationId}:${session.userId}`,
          );
          if (!principalDecision.allowed) decision = principalDecision;
          const archiveId = (request.params as { archiveId?: unknown } | undefined)?.archiveId;
          if (typeof archiveId === 'string' && session.archiveIds.includes(archiveId)) {
            if (
              dependencies?.sessionMembershipChecker &&
              !(await dependencies.sessionMembershipChecker(
                { organizationId: session.organizationId, familyArchiveId: archiveId },
                session.userId,
              ))
            )
              throw new ApiProblem('AUTH_REQUIRED', 'Session membership is no longer valid');
            const archiveDecision = await rateLimiter.consume(
              `archive:${session.organizationId}:${archiveId}`,
            );
            if (!archiveDecision.allowed) decision = archiveDecision;
          }
        }
      }
    } catch (error) {
      if (error instanceof ApiProblem) throw error;
      throw new ApiProblem('PROVIDER_UNAVAILABLE', 'Rate limiter is unavailable', true);
    }
    reply
      .header('RateLimit-Limit', String(decision.limit))
      .header('RateLimit-Remaining', String(decision.remaining));
    if (!decision.allowed) {
      reply.header('Retry-After', String(decision.retryAfterSeconds));
      throw new ApiProblem('RATE_LIMITED', 'Request rate limit exceeded', true);
    }
  });

  app.get('/health/live', () =>
    healthStatusSchema.parse({
      service: 'api',
      status: 'live',
      timestamp: new Date().toISOString(),
    }),
  );
  app.get('/health/ready', async (_request, reply) => {
    const ready = dependencies ? await dependencies.service.ready() : true;
    return reply.status(ready ? 200 : 503).send(
      healthStatusSchema.parse({
        service: 'api',
        status: ready ? 'ready' : 'degraded',
        timestamp: new Date().toISOString(),
      }),
    );
  });

  if (dependencies) registerV1Routes(app, dependencies);

  return app;
}
