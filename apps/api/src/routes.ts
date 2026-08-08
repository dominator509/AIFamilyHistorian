import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
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
  parseAuthorizationHeader,
  type SessionRevocationStore,
  verifySessionToken,
  type SessionPrincipal,
} from '@family-historian/auth';

interface RouteDependencies {
  service: ArchiveService;
  sessionSecret: string;
  sessionRevocationStore?: SessionRevocationStore;
  sessionMembershipChecker?: (
    context: { organizationId: string; familyArchiveId: string },
    userId: string,
  ) => Promise<boolean>;
  stripeWebhookSecret?: string;
}

const stripeWebhookEventSchema = z.object({
  id: z.string().regex(/^evt_[A-Za-z0-9]+$/u),
  type: z.string().min(1).max(200),
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

function authorizeArchive(
  request: FastifyRequest,
  secret: string,
  archiveId: string,
  permission: string,
): SessionPrincipal {
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
  return value;
}

async function assertCurrentArchiveMembership(
  dependencies: RouteDependencies,
  value: SessionPrincipal,
  archiveId: string,
): Promise<void> {
  if (
    dependencies.sessionMembershipChecker &&
    !(await dependencies.sessionMembershipChecker(
      { organizationId: value.organizationId, familyArchiveId: archiveId },
      value.userId,
    ))
  )
    throw new ApiProblem('AUTH_REQUIRED', 'Session membership is no longer valid');
}

function idempotencyKey(request: FastifyRequest): string {
  const value = request.headers['idempotency-key'];
  if (Array.isArray(value))
    throw new ApiProblem('VALIDATION_FAILED', 'One Idempotency-Key is required');
  return idempotencyKeySchema.parse(value);
}

export function registerV1Routes(app: FastifyInstance, dependencies: RouteDependencies): void {
  app.post('/v1/session/logout', async (request, reply) => {
    const value = principal(request, dependencies.sessionSecret);
    if (!value.sessionId)
      throw new ApiProblem('AUTH_REQUIRED', 'Session does not support revocation');
    if (!dependencies.sessionRevocationStore)
      throw new ApiProblem('PROVIDER_UNAVAILABLE', 'Session revocation is not configured', true);
    await dependencies.sessionRevocationStore.revoke(value.sessionId, value.expiresAt);
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
    if (dependencies.sessionMembershipChecker) {
      for (const archiveId of value.archiveIds) {
        if (
          !(await dependencies.sessionMembershipChecker(
            { organizationId: value.organizationId, familyArchiveId: archiveId },
            value.userId,
          ))
        )
          throw new ApiProblem('AUTH_REQUIRED', 'Session membership is no longer valid');
      }
    }
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
    const value = authorizeArchive(request, dependencies.sessionSecret, archiveId, 'uploads:write');
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
    const value = authorizeArchive(request, dependencies.sessionSecret, archiveId, 'uploads:read');
    return dependencies.service.uploadStatus(
      { organizationId: value.organizationId, familyArchiveId: archiveId },
      uploadId,
    );
  });

  app.get('/v1/archives/:archiveId/uploads/:uploadId/parts/:partNumber', async (request) => {
    const { archiveId, uploadId, partNumber } = uploadPartParamsSchema.parse(request.params);
    const value = authorizeArchive(request, dependencies.sessionSecret, archiveId, 'uploads:write');
    return dependencies.service.signUploadPart(
      { organizationId: value.organizationId, familyArchiveId: archiveId },
      uploadId,
      partNumber,
    );
  });

  app.post('/v1/archives/:archiveId/uploads/:uploadId/complete', async (request, reply) => {
    const { archiveId, uploadId } = uploadParamsSchema.parse(request.params);
    const value = authorizeArchive(request, dependencies.sessionSecret, archiveId, 'uploads:write');
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
    const value = authorizeArchive(request, dependencies.sessionSecret, archiveId, 'uploads:write');
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
      const value = authorizeArchive(
        request,
        dependencies.sessionSecret,
        archiveId,
        `${resource.kind}:read`,
      );
      return {
        items: await dependencies.service.list(resource.kind, {
          organizationId: value.organizationId,
          familyArchiveId: archiveId,
        }),
      };
    });
    app.post(route, async (request, reply) => {
      const { archiveId } = archiveParamsSchema.parse(request.params);
      const value = authorizeArchive(
        request,
        dependencies.sessionSecret,
        archiveId,
        `${resource.kind}:write`,
      );
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
    const archiveId =
      input.archiveId ?? principal(request, dependencies.sessionSecret).archiveIds[0];
    if (!archiveId) throw new ApiProblem('PERMISSION_DENIED', 'An archive scope is required');
    const value = authorizeArchive(request, dependencies.sessionSecret, archiveId, 'privacy:write');
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
    const value = principal(request, dependencies.sessionSecret);
    if (!value.permissions.includes('billing:write'))
      throw new ApiProblem('PERMISSION_DENIED', 'Billing permission is required');
    const archiveId = value.archiveIds[0];
    if (!archiveId) throw new ApiProblem('PERMISSION_DENIED', 'An archive scope is required');
    await assertCurrentArchiveMembership(dependencies, value, archiveId);
    const result = await dependencies.service.create(
      { organizationId: value.organizationId, familyArchiveId: archiveId },
      value.userId,
      idempotencyKey(request),
      '/v1/billing',
      { kind: 'billing', input: billingInputSchema.parse(request.body) },
    );
    return reply
      .status(201)
      .header('Idempotency-Replayed', String(result.replayed))
      .send(result.response);
  });
}
