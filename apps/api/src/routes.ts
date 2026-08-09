import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  archiveParamsSchema,
  billingInputSchema,
  chapterInputSchema,
  completeUploadInputSchema,
  editionInputSchema,
  eventInputSchema,
  exportInputSchema,
  factInputSchema,
  idempotencyKeySchema,
  mediaInputSchema,
  memberInputSchema,
  narrationInputSchema,
  personInputSchema,
  privacyRequestInputSchema,
  recordingSessionInputSchema,
  rightsInputSchema,
  shareInputSchema,
  transcriptInputSchema,
  uploadInputSchema,
  uploadParamsSchema,
  uploadPartParamsSchema,
  uuidSchema,
} from '@family-historian/contracts';
import { ProviderAdapterError, verifyStripeWebhookSignature } from '@family-historian/providers';
import type { ArchiveService, ListResourceKind } from './archive-service.js';
import { ApiProblem } from './problems.js';
import {
  authorizeArchivePermission,
  issueSessionToken,
  parseAuthorizationHeader,
  type SessionRevocationStore,
  type SessionStore,
  verifySessionToken,
  type SessionPrincipal,
} from '@family-historian/auth';

interface RouteDependencies {
  service: ArchiveService;
  sessionSecret: string;
  sessionRevocationStore?: SessionRevocationStore;
  sessionStore?: SessionStore;
  sessionMembershipChecker?: (
    context: { organizationId: string; familyArchiveId: string },
    userId: string,
  ) => Promise<boolean>;
  sessionPermissionChecker?: (
    context: { organizationId: string; familyArchiveId: string },
    userId: string,
    permission: string,
  ) => Promise<boolean>;
  stripeWebhookSecret?: string;
}

const STRIPE_EVENT_ID_MAX_CHARS = 256;
const STRIPE_EVENT_TYPE_MAX_CHARS = 200;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/u;

const stripeWebhookEventSchema = z.object({
  id: z
    .string()
    .max(STRIPE_EVENT_ID_MAX_CHARS)
    .regex(/^evt_[A-Za-z0-9]+$/u),
  type: z
    .string()
    .min(1)
    .max(STRIPE_EVENT_TYPE_MAX_CHARS)
    .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value), 'event type contains controls'),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});

type ResourceDefinition = {
  kind: ListResourceKind;
  schema: z.ZodType;
};

const resources: readonly ResourceDefinition[] = [
  { kind: 'members', schema: memberInputSchema },
  { kind: 'recording-sessions', schema: recordingSessionInputSchema },
  { kind: 'media', schema: mediaInputSchema },
  { kind: 'transcripts', schema: transcriptInputSchema },
  { kind: 'people', schema: personInputSchema },
  { kind: 'events', schema: eventInputSchema },
  { kind: 'facts', schema: factInputSchema },
  { kind: 'chapters', schema: chapterInputSchema },
  { kind: 'editions', schema: editionInputSchema },
  { kind: 'narration', schema: narrationInputSchema },
  { kind: 'shares', schema: shareInputSchema },
  { kind: 'exports', schema: exportInputSchema },
  { kind: 'rights', schema: rightsInputSchema },
];

function principal(request: FastifyRequest, secret: string): SessionPrincipal {
  try {
    const token = parseAuthorizationHeader(request.headers.authorization);
    return verifySessionToken(secret, token);
  } catch {
    throw new ApiProblem('AUTH_REQUIRED', 'Authentication required');
  }
}

async function authorizeArchive(
  request: FastifyRequest,
  secret: string,
  archiveId: string,
  permission: string,
  dependencies: RouteDependencies,
): Promise<SessionPrincipal> {
  const value = principal(request, secret);
  try {
    authorizeArchivePermission(value, archiveId, permission);
  } catch (error) {
    const code =
      error instanceof Error && error.message === 'PERMISSION_DENIED'
        ? 'PERMISSION_DENIED'
        : 'AUTH_REQUIRED';
    throw new ApiProblem(code, 'Archive access is not authorized');
  }
  await assertCurrentArchivePermission(dependencies, value, archiveId, permission);
  return value;
}

async function assertCurrentArchiveMembership(
  dependencies: RouteDependencies,
  value: SessionPrincipal,
  archiveId: string,
): Promise<void> {
  if (!dependencies.sessionMembershipChecker)
    throw new ApiProblem('PROVIDER_UNAVAILABLE', 'Archive authorization is not configured', true);
  let current: boolean;
  try {
    current = await dependencies.sessionMembershipChecker(
      { organizationId: value.organizationId, familyArchiveId: archiveId },
      value.userId,
    );
  } catch {
    throw new ApiProblem('PROVIDER_UNAVAILABLE', 'Archive authorization is unavailable', true);
  }
  if (!current) throw new ApiProblem('AUTH_REQUIRED', 'Session membership is no longer valid');
}

async function assertCurrentArchivePermission(
  dependencies: RouteDependencies,
  value: SessionPrincipal,
  archiveId: string,
  permission: string,
): Promise<void> {
  if (!dependencies.sessionPermissionChecker)
    throw new ApiProblem('PROVIDER_UNAVAILABLE', 'Archive authorization is not configured', true);
  let current: boolean;
  try {
    current = await dependencies.sessionPermissionChecker(
      { organizationId: value.organizationId, familyArchiveId: archiveId },
      value.userId,
      permission,
    );
  } catch {
    throw new ApiProblem('PROVIDER_UNAVAILABLE', 'Archive authorization is unavailable', true);
  }
  if (!current) throw new ApiProblem('PERMISSION_DENIED', 'Archive permission is no longer valid');
}

function resolveArchiveScope(
  value: SessionPrincipal,
  requestedArchiveId: string | undefined,
  resource: string,
): string {
  const archiveId =
    requestedArchiveId ?? (value.archiveIds.length === 1 ? value.archiveIds[0] : undefined);
  if (!archiveId)
    throw new ApiProblem(
      'VALIDATION_FAILED',
      `${resource} archive scope is required when multiple archives are available`,
    );
  return archiveId;
}

function idempotencyKey(request: FastifyRequest): string {
  const value = request.headers['idempotency-key'];
  if (Array.isArray(value))
    throw new ApiProblem('VALIDATION_FAILED', 'One Idempotency-Key is required');
  return idempotencyKeySchema.parse(value);
}

function sessionMetadata(request: FastifyRequest): {
  userAgent?: string;
  ipAddress?: string;
} {
  const userAgent = request.headers['user-agent'];
  return {
    ...(typeof userAgent === 'string' ? { userAgent } : {}),
    ...(request.ip ? { ipAddress: request.ip } : {}),
  };
}

function requireSessionStore(dependencies: RouteDependencies): SessionStore {
  if (!dependencies.sessionStore)
    throw new ApiProblem('PROVIDER_UNAVAILABLE', 'Server-side sessions are not configured', true);
  return dependencies.sessionStore;
}

async function sessionStoreOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiProblem) throw error;
    if (error instanceof Error && error.message === 'AUTH_REQUIRED')
      throw new ApiProblem('AUTH_REQUIRED', 'Session is not active');
    throw new ApiProblem('PROVIDER_UNAVAILABLE', 'Session store is unavailable', true);
  }
}

export function registerV1Routes(app: FastifyInstance, dependencies: RouteDependencies): void {
  app.post('/v1/session/register', async (request, reply) => {
    const value = principal(request, dependencies.sessionSecret);
    const store = requireSessionStore(dependencies);
    const stored = await sessionStoreOperation(() => store.ensure(value, sessionMetadata(request)));
    if (!stored) throw new ApiProblem('AUTH_REQUIRED', 'Session is not active');
    return reply.status(204).send();
  });

  app.get('/v1/session', async (request) => {
    const value = principal(request, dependencies.sessionSecret);
    const store = requireSessionStore(dependencies);
    const sessions = await sessionStoreOperation(() =>
      store.listForUser(value.userId, value.organizationId),
    );
    return {
      items: sessions.map((session) => ({
        sessionId: session.sessionId,
        deviceLabel: session.deviceLabel,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt,
        current: session.sessionId === value.sessionId,
      })),
    };
  });

  app.post('/v1/session/rotate', async (request) => {
    const value = principal(request, dependencies.sessionSecret);
    if (!value.sessionId)
      throw new ApiProblem('AUTH_REQUIRED', 'Session does not support rotation');
    const store = requireSessionStore(dependencies);
    const now = Math.floor(Date.now() / 1000);
    const replacement = {
      ...value,
      sessionId: randomUUID(),
      expiresAt: now + 24 * 60 * 60,
    };
    const token = issueSessionToken(dependencies.sessionSecret, replacement);
    await sessionStoreOperation(() =>
      store.rotate(value.sessionId!, replacement, sessionMetadata(request)),
    );
    await dependencies.sessionRevocationStore?.revoke(value.sessionId, value.expiresAt);
    return {
      token,
      sessionId: replacement.sessionId,
      expiresAt: replacement.expiresAt,
    };
  });

  app.post('/v1/session/revoke/:sessionId', async (request, reply) => {
    const value = principal(request, dependencies.sessionSecret);
    if (!value.sessionId)
      throw new ApiProblem('AUTH_REQUIRED', 'Session does not support revocation');
    const target = uuidSchema.parse((request.params as { sessionId?: unknown }).sessionId);
    const store = requireSessionStore(dependencies);
    const session = await sessionStoreOperation(() => store.find(target));
    if (
      !session ||
      session.userId !== value.userId ||
      session.organizationId !== value.organizationId
    )
      throw new ApiProblem('AUTH_REQUIRED', 'Session is not available');
    if (
      target !== value.sessionId &&
      !value.permissions.includes('sessions:admin') &&
      !value.permissions.includes('archive:*')
    )
      throw new ApiProblem('PERMISSION_DENIED', 'Session administration permission is required');
    await sessionStoreOperation(() =>
      store.revoke(
        target,
        target === value.sessionId ? 'self' : 'administrative',
        value.organizationId,
      ),
    );
    await dependencies.sessionRevocationStore?.revoke(target, session.expiresAt);
    return reply.status(204).send();
  });

  app.post('/v1/session/revoke-all', async (request) => {
    const value = principal(request, dependencies.sessionSecret);
    if (!value.sessionId)
      throw new ApiProblem('AUTH_REQUIRED', 'Session does not support revocation');
    const store = requireSessionStore(dependencies);
    const sessions = await sessionStoreOperation(() =>
      store.listForUser(value.userId, value.organizationId),
    );
    const count = await sessionStoreOperation(() =>
      store.revokeAllForUser(value.userId, value.sessionId, value.organizationId),
    );
    if (dependencies.sessionRevocationStore) {
      await Promise.all(
        sessions
          .filter((session) => session.sessionId !== value.sessionId && !session.revokedAt)
          .map((session) =>
            dependencies.sessionRevocationStore!.revoke(session.sessionId, session.expiresAt),
          ),
      );
    }
    return { revoked: count };
  });

  app.post('/v1/session/logout', async (request, reply) => {
    const value = principal(request, dependencies.sessionSecret);
    if (!value.sessionId)
      throw new ApiProblem('AUTH_REQUIRED', 'Session does not support revocation');
    if (!dependencies.sessionRevocationStore && !dependencies.sessionStore)
      throw new ApiProblem('PROVIDER_UNAVAILABLE', 'Session revocation is not configured', true);
    await dependencies.sessionRevocationStore?.revoke(value.sessionId, value.expiresAt);
    if (dependencies.sessionStore)
      await sessionStoreOperation(() =>
        dependencies.sessionStore!.revoke(value.sessionId!, 'self'),
      );
    return reply.status(204).send();
  });

  app.post('/v1/webhooks/stripe', async (request, reply) => {
    const rawBody = (request as FastifyRequest & { rawBody?: string }).rawBody;
    const signature = request.headers['stripe-signature'];
    if (typeof rawBody !== 'string' || typeof signature !== 'string')
      throw new ApiProblem(
        'VALIDATION_FAILED',
        'Stripe webhook payload and signature are required',
      );
    if (!dependencies.stripeWebhookSecret)
      throw new ApiProblem(
        'PROVIDER_UNAVAILABLE',
        'Stripe webhook verification is not configured',
        true,
      );
    try {
      verifyStripeWebhookSignature(rawBody, signature, dependencies.stripeWebhookSecret);
    } catch (error) {
      if (error instanceof ProviderAdapterError)
        throw new ApiProblem('VALIDATION_FAILED', 'Stripe webhook signature is invalid');
      throw error;
    }
    const parsed = stripeWebhookEventSchema.safeParse(request.body);
    if (!parsed.success)
      throw new ApiProblem('VALIDATION_FAILED', 'Stripe webhook payload is invalid');
    const metadata = parsed.data.data.object.metadata as Record<string, unknown> | undefined;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
      throw new ApiProblem('VALIDATION_FAILED', 'Stripe webhook metadata is required');
    const organizationId = uuidSchema.safeParse(metadata.organization_id);
    const familyArchiveId = uuidSchema.safeParse(metadata.family_archive_id);
    if (!organizationId.success || !familyArchiveId.success)
      throw new ApiProblem('VALIDATION_FAILED', 'Stripe webhook tenant metadata is invalid');
    const result = await dependencies.service.recordStripeWebhook(
      { organizationId: organizationId.data, familyArchiveId: familyArchiveId.data },
      {
        eventId: parsed.data.id,
        eventType: parsed.data.type,
        payload: parsed.data,
        payloadSha256: createHash('sha256').update(rawBody, 'utf8').digest('hex'),
      },
    );
    if (result.replayed) reply.header('Idempotency-Replayed', 'true');
    return reply.status(200).send({ status: 'accepted', eventId: parsed.data.id });
  });

  app.get('/v1/archives', async (request) => {
    const value = principal(request, dependencies.sessionSecret);
    for (const archiveId of value.archiveIds)
      await assertCurrentArchiveMembership(dependencies, value, archiveId);
    const archives = (
      await Promise.all(
        value.archiveIds.map((archiveId) =>
          dependencies.service.getArchive({
            organizationId: value.organizationId,
            familyArchiveId: archiveId,
          }),
        ),
      )
    ).filter((archive) => archive !== null);
    return { items: archives };
  });

  app.post('/v1/archives/:archiveId/uploads', async (request, reply) => {
    const { archiveId } = archiveParamsSchema.parse(request.params);
    const value = await authorizeArchive(
      request,
      dependencies.sessionSecret,
      archiveId,
      'uploads:write',
      dependencies,
    );
    await assertCurrentArchiveMembership(dependencies, value, archiveId);
    const result = await dependencies.service.beginUpload(
      { organizationId: value.organizationId, familyArchiveId: archiveId },
      value.userId,
      idempotencyKey(request),
      uploadInputSchema.parse(request.body),
    );
    return reply
      .status(201)
      .header('Idempotency-Replayed', String(result.replayed))
      .send(result.response);
  });

  app.get('/v1/archives/:archiveId/uploads/:uploadId', async (request) => {
    const { archiveId, uploadId } = uploadParamsSchema.parse(request.params);
    const value = await authorizeArchive(
      request,
      dependencies.sessionSecret,
      archiveId,
      'uploads:read',
      dependencies,
    );
    await assertCurrentArchiveMembership(dependencies, value, archiveId);
    return dependencies.service.uploadStatus(
      { organizationId: value.organizationId, familyArchiveId: archiveId },
      value.userId,
      uploadId,
    );
  });

  app.get('/v1/archives/:archiveId/uploads/:uploadId/parts/:partNumber', async (request) => {
    const { archiveId, uploadId, partNumber } = uploadPartParamsSchema.parse(request.params);
    const value = await authorizeArchive(
      request,
      dependencies.sessionSecret,
      archiveId,
      'uploads:write',
      dependencies,
    );
    await assertCurrentArchiveMembership(dependencies, value, archiveId);
    return dependencies.service.signUploadPart(
      { organizationId: value.organizationId, familyArchiveId: archiveId },
      value.userId,
      uploadId,
      partNumber,
    );
  });

  app.post('/v1/archives/:archiveId/uploads/:uploadId/complete', async (request, reply) => {
    const { archiveId, uploadId } = uploadParamsSchema.parse(request.params);
    const value = await authorizeArchive(
      request,
      dependencies.sessionSecret,
      archiveId,
      'uploads:write',
      dependencies,
    );
    await assertCurrentArchiveMembership(dependencies, value, archiveId);
    const input = completeUploadInputSchema.parse(request.body);
    const parts = input.parts.map(({ ETag, PartNumber, ChecksumSHA256 }) => ({
      ETag,
      PartNumber,
      ...(ChecksumSHA256 ? { ChecksumSHA256 } : {}),
    }));
    const result = await dependencies.service.completeUpload(
      { organizationId: value.organizationId, familyArchiveId: archiveId },
      value.userId,
      idempotencyKey(request),
      uploadId,
      parts,
    );
    return reply
      .status(200)
      .header('Idempotency-Replayed', String(result.replayed))
      .send(result.response);
  });

  app.post('/v1/archives/:archiveId/uploads/:uploadId/abort', async (request, reply) => {
    const { archiveId, uploadId } = uploadParamsSchema.parse(request.params);
    const value = await authorizeArchive(
      request,
      dependencies.sessionSecret,
      archiveId,
      'uploads:write',
      dependencies,
    );
    await assertCurrentArchiveMembership(dependencies, value, archiveId);
    const result = await dependencies.service.abortUpload(
      { organizationId: value.organizationId, familyArchiveId: archiveId },
      value.userId,
      idempotencyKey(request),
      uploadId,
    );
    return reply
      .status(200)
      .header('Idempotency-Replayed', String(result.replayed))
      .send(result.response);
  });

  for (const resource of resources) {
    const route = `/v1/archives/:archiveId/${resource.kind}`;
    app.get(route, async (request) => {
      const { archiveId } = archiveParamsSchema.parse(request.params);
      const value = await authorizeArchive(
        request,
        dependencies.sessionSecret,
        archiveId,
        `${resource.kind}:read`,
        dependencies,
      );
      await assertCurrentArchiveMembership(dependencies, value, archiveId);
      return {
        items: await dependencies.service.list(resource.kind, {
          organizationId: value.organizationId,
          familyArchiveId: archiveId,
        }),
      };
    });
    app.post(route, async (request, reply) => {
      const { archiveId } = archiveParamsSchema.parse(request.params);
      const value = await authorizeArchive(
        request,
        dependencies.sessionSecret,
        archiveId,
        `${resource.kind}:write`,
        dependencies,
      );
      await assertCurrentArchiveMembership(dependencies, value, archiveId);
      const result = await dependencies.service.create(
        { organizationId: value.organizationId, familyArchiveId: archiveId },
        value.userId,
        idempotencyKey(request),
        route,
        { kind: resource.kind, input: resource.schema.parse(request.body) } as Parameters<
          ArchiveService['create']
        >[4],
      );
      return reply
        .status(201)
        .header('Idempotency-Replayed', String(result.replayed))
        .send(result.response);
    });
  }

  app.post('/v1/privacy-requests', async (request, reply) => {
    const input = privacyRequestInputSchema.parse(request.body);
    const session = principal(request, dependencies.sessionSecret);
    const archiveId = resolveArchiveScope(session, input.archiveId, 'Privacy request');
    const value = await authorizeArchive(
      request,
      dependencies.sessionSecret,
      archiveId,
      'privacy:write',
      dependencies,
    );
    await assertCurrentArchiveMembership(dependencies, value, archiveId);
    const result = await dependencies.service.create(
      { organizationId: value.organizationId, familyArchiveId: archiveId },
      value.userId,
      idempotencyKey(request),
      '/v1/privacy-requests',
      { kind: 'privacy-requests', input },
    );
    return reply
      .status(201)
      .header('Idempotency-Replayed', String(result.replayed))
      .send(result.response);
  });

  app.post('/v1/billing', async (request, reply) => {
    const input = billingInputSchema.parse(request.body);
    const value = principal(request, dependencies.sessionSecret);
    const archiveId = resolveArchiveScope(value, input.archiveId, 'Billing');
    await authorizeArchive(
      request,
      dependencies.sessionSecret,
      archiveId,
      'billing:write',
      dependencies,
    );
    await assertCurrentArchiveMembership(dependencies, value, archiveId);
    const result = await dependencies.service.create(
      { organizationId: value.organizationId, familyArchiveId: archiveId },
      value.userId,
      idempotencyKey(request),
      '/v1/billing',
      { kind: 'billing', input },
    );
    return reply
      .status(201)
      .header('Idempotency-Replayed', String(result.replayed))
      .send(result.response);
  });
}
