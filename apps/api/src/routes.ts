import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { z } from 'zod';
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
} from '@family-historian/contracts';
import type { ArchiveService, ListResourceKind } from './archive-service.js';
import { ApiProblem } from './problems.js';
import {
  authorizeArchivePermission,
  parseAuthorizationHeader,
  verifySessionToken,
  type SessionPrincipal,
} from '@family-historian/auth';

interface RouteDependencies {
  service: ArchiveService;
  sessionSecret: string;
}

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

function idempotencyKey(request: FastifyRequest): string {
  const value = request.headers['idempotency-key'];
  if (Array.isArray(value))
    throw new ApiProblem('VALIDATION_FAILED', 'One Idempotency-Key is required');
  return idempotencyKeySchema.parse(value);
}

export function registerV1Routes(app: FastifyInstance, dependencies: RouteDependencies): void {
  app.get('/v1/archives', async (request) => {
    const value = principal(request, dependencies.sessionSecret);
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
