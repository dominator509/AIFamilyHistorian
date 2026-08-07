import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';
import { healthStatusSchema } from '@family-historian/contracts';
import type { ArchiveService } from './archive-service.js';
import { sendProblem } from './problems.js';
import { registerV1Routes } from './routes.js';

export interface AppDependencies {
  service: ArchiveService;
  sessionSecret: string;
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

  await app.register(helmet, { global: true });
  await app.register(cors, { origin: false, credentials: false });
  app.setErrorHandler((error, request, reply) => sendProblem(error, request, reply));

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
