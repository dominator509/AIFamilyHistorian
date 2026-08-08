import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  exportInputSchema,
  narrationInputSchema,
  privacyRequestInputSchema,
} from '@family-historian/contracts';
import { uuidV7, type DatabaseClient } from '@family-historian/database';
import {
  buildMediaPipelinePlan,
  MediaExecutionError,
  executeMediaPipelineStep,
  type MediaKind,
  type MediaToolExecutionOptions,
} from '@family-historian/media';
import { derivativeObjectKey, type ObjectStorage } from '@family-historian/storage';
import { WorkerJobError, type WorkerJobHandler } from './dispatcher.js';

const mediaPayloadSchema = z.object({
  aggregateId: z.uuid(),
  payload: z.object({ objectKey: z.string().min(1).max(512) }),
});

const privacyPayloadSchema = z.object({
  aggregateId: z.uuid(),
  payload: privacyRequestInputSchema,
});

const exportPayloadSchema = z.object({
  aggregateId: z.uuid(),
  payload: exportInputSchema,
});

const narrationPayloadSchema = z.object({
  aggregateId: z.uuid(),
  payload: narrationInputSchema,
});

const MAX_DERIVATIVE_BYTES = 256 * 1024 * 1024;
const MAX_TOTAL_DERIVATIVE_BYTES = 512 * 1024 * 1024;

export interface WorkerHandlerOptions {
  readonly storage: ObjectStorage;
  readonly binaries?: MediaToolExecutionOptions['binaries'];
}

export function createDefaultHandlers(
  options: WorkerHandlerOptions,
): ReadonlyMap<string, WorkerJobHandler> {
  return new Map([
    ['media.scan', (context) => handleMediaScan(context, options)],
    ['privacy.request', handlePrivacyRequest],
    ['export.portable', (context) => handleExportIntake(context, 'portable')],
    ['export.book', (context) => handleExportIntake(context, 'book')],
    ['export.epub', (context) => handleExportIntake(context, 'epub')],
    ['export.audiobook', (context) => handleExportIntake(context, 'audiobook')],
    ['narration.generate', handleNarrationIntake],
  ]);
}

async function handleExportIntake(
  context: Parameters<WorkerJobHandler>[0],
  expectedKind: 'portable' | 'book' | 'epub' | 'audiobook',
): Promise<void> {
  const parsed = exportPayloadSchema.safeParse(context.job.payload);
  if (!parsed.success || parsed.data.payload.kind !== expectedKind)
    throw new WorkerJobError('export payload is invalid', 'JOB_PAYLOAD_INVALID', false);
  if (!context.job.familyArchiveId)
    throw new WorkerJobError('export archive scope is missing', 'JOB_SCOPE_INVALID', false);
  const { aggregateId } = parsed.data;
  await context.withTenant(async (client) => {
    const current = await client.query<{ status: string }>(
      `select status from export_jobs
        where id = $1 and organization_id = $2 and family_archive_id = $3`,
      [aggregateId, context.job.organizationId, context.job.familyArchiveId],
    );
    const job = current.rows[0];
    if (!job)
      throw new WorkerJobError(
        'export job is outside the worker scope',
        'PERMISSION_DENIED',
        false,
      );
    if (job.status === 'completed' || job.status === 'cancelled') return;
    if (job.status !== 'queued' && job.status !== 'retryable_failed') return;
    const updated = await client.query(
      `update export_jobs set status = 'running'
        where id = $1 and organization_id = $2 and family_archive_id = $3
          and status in ('queued', 'retryable_failed') returning id`,
      [aggregateId, context.job.organizationId, context.job.familyArchiveId],
    );
    if (updated.rowCount !== 1) return;
    await appendReviewAudit(client, context, 'export.accepted', {
      exportJobId: aggregateId,
      kind: expectedKind,
    });
  });
}

async function handleNarrationIntake(context: Parameters<WorkerJobHandler>[0]): Promise<void> {
  const parsed = narrationPayloadSchema.safeParse(context.job.payload);
  if (!parsed.success)
    throw new WorkerJobError('narration payload is invalid', 'JOB_PAYLOAD_INVALID', false);
  if (!context.job.familyArchiveId)
    throw new WorkerJobError('narration archive scope is missing', 'JOB_SCOPE_INVALID', false);
  const { aggregateId, payload } = parsed.data;
  await context.withTenant(async (client) => {
    const current = await client.query<{
      status: string;
      edition_id: string;
      voice_authorization_id: string;
    }>(
      `select status, edition_id, voice_authorization_id from narration_jobs
        where id = $1 and organization_id = $2 and family_archive_id = $3`,
      [aggregateId, context.job.organizationId, context.job.familyArchiveId],
    );
    const job = current.rows[0];
    if (!job)
      throw new WorkerJobError(
        'narration job is outside the worker scope',
        'PERMISSION_DENIED',
        false,
      );
    if (
      job.edition_id !== payload.editionId ||
      job.voice_authorization_id !== payload.voiceAuthorizationId
    )
      throw new WorkerJobError(
        'narration payload does not match authoritative data',
        'JOB_PAYLOAD_INVALID',
        false,
      );
    if (job.status === 'completed' || job.status === 'cancelled') return;
    if (job.status !== 'queued' && job.status !== 'retryable_failed') return;
    const updated = await client.query(
      `update narration_jobs set status = 'running'
        where id = $1 and organization_id = $2 and family_archive_id = $3
          and status in ('queued', 'retryable_failed') returning id`,
      [aggregateId, context.job.organizationId, context.job.familyArchiveId],
    );
    if (updated.rowCount !== 1) return;
    await appendReviewAudit(client, context, 'narration.accepted', {
      narrationJobId: aggregateId,
      editionId: payload.editionId,
      voiceAuthorizationId: payload.voiceAuthorizationId,
    });
  });
}

async function appendReviewAudit(
  client: DatabaseClient,
  context: Parameters<WorkerJobHandler>[0],
  action: string,
  metadata: Record<string, string>,
): Promise<void> {
  await client.query(
    `insert into audit_events(
       id, organization_id, family_archive_id, actor_pseudonym, action, outcome, metadata, occurred_at
     ) values ($1, $2, $3, 'worker:job-intake', $4, 'review_required', $5, now())`,
    [uuidV7(), context.job.organizationId, context.job.familyArchiveId, action, metadata],
  );
}

/**
 * Accept a privacy request into the authoritative review queue. This handler
 * never claims to fulfill access, correction, export, restriction, objection,
 * or deletion; it records the scoped handoff and leaves the request running
 * until a provider-independent review/fulfillment worker is implemented.
 */
async function handlePrivacyRequest(context: Parameters<WorkerJobHandler>[0]): Promise<void> {
  const parsed = privacyPayloadSchema.safeParse(context.job.payload);
  if (!parsed.success)
    throw new WorkerJobError('privacy request payload is invalid', 'JOB_PAYLOAD_INVALID', false);
  if (!context.job.familyArchiveId)
    throw new WorkerJobError(
      'privacy request archive scope is missing',
      'JOB_SCOPE_INVALID',
      false,
    );
  const { aggregateId, payload } = parsed.data;
  await context.withTenant(async (client) => {
    const current = await client.query<{
      request_type: string;
      status: string;
      requester_reference: string;
      family_archive_id: string;
    }>(
      `select request_type, status, requester_reference, family_archive_id
         from privacy_requests
        where id = $1 and organization_id = $2 and family_archive_id = $3`,
      [aggregateId, context.job.organizationId, context.job.familyArchiveId],
    );
    const request = current.rows[0];
    if (!request)
      throw new WorkerJobError(
        'privacy request is outside the worker scope',
        'PERMISSION_DENIED',
        false,
      );
    if (
      request.request_type !== payload.requestType ||
      request.requester_reference !== payload.requesterReference ||
      (payload.archiveId ?? context.job.familyArchiveId) !== request.family_archive_id
    )
      throw new WorkerJobError(
        'privacy request payload does not match authoritative data',
        'JOB_PAYLOAD_INVALID',
        false,
      );
    if (request.status === 'completed' || request.status === 'cancelled') return;
    if (request.status !== 'queued' && request.status !== 'retryable_failed') return;
    const updated = await client.query(
      `update privacy_requests
          set status = 'running'
        where id = $1 and organization_id = $2 and family_archive_id = $3
          and status in ('queued', 'retryable_failed')
        returning id`,
      [aggregateId, context.job.organizationId, context.job.familyArchiveId],
    );
    if (updated.rowCount !== 1) return;

    if (payload.requestType === 'deletion') {
      await client.query(
        `insert into deletion_jobs(
           id, organization_id, family_archive_id, status, idempotency_key, grace_ends_at, evidence
         ) values ($1, $2, $3, 'queued', $4, now() + interval '30 days', $5)
         on conflict (organization_id, idempotency_key) do nothing`,
        [
          uuidV7(),
          context.job.organizationId,
          context.job.familyArchiveId,
          `privacy-request:${aggregateId}`,
          JSON.stringify([
            { source: 'privacy_request', privacyRequestId: aggregateId, state: 'review_required' },
          ]),
        ],
      );
    }
    await client.query(
      `insert into audit_events(
         id, organization_id, family_archive_id, actor_pseudonym, action, outcome, metadata, occurred_at
       ) values ($1, $2, $3, $4, $5, 'review_required', $6, now())`,
      [
        uuidV7(),
        context.job.organizationId,
        context.job.familyArchiveId,
        'worker:privacy-intake',
        'privacy_request.accepted',
        {
          requestType: payload.requestType,
          privacyRequestId: aggregateId,
          requesterReferenceHash: createHash('sha256')
            .update(payload.requesterReference, 'utf8')
            .digest('hex'),
        },
      ],
    );
  });
}

async function handleMediaScan(
  context: Parameters<WorkerJobHandler>[0],
  options: WorkerHandlerOptions,
): Promise<void> {
  const parsed = mediaPayloadSchema.safeParse(context.job.payload);
  if (!parsed.success)
    throw new WorkerJobError('media scan payload is invalid', 'JOB_PAYLOAD_INVALID', false);
  const { aggregateId, payload } = parsed.data;
  if (!context.job.familyArchiveId)
    throw new WorkerJobError('media scan archive scope is missing', 'JOB_SCOPE_INVALID', false);
  let original: Awaited<ReturnType<typeof loadOriginal>>;
  let descriptor: {
    readonly id: string;
    readonly objectKey: string;
    readonly contentType: string;
    readonly byteSize: number;
    readonly sha256Hex: string;
    readonly kind: MediaKind;
  };
  try {
    const loaded = await context.withTenant(
      async (
        client,
      ): Promise<
        | { original: Awaited<ReturnType<typeof loadOriginal>>; done: true }
        | {
            original: Awaited<ReturnType<typeof loadOriginal>>;
            done: false;
            descriptor: {
              readonly id: string;
              readonly objectKey: string;
              readonly contentType: string;
              readonly byteSize: number;
              readonly sha256Hex: string;
              readonly kind: MediaKind;
            };
          }
      > => {
        const current = await loadOriginal(
          client,
          context.job.organizationId,
          context.job.familyArchiveId!,
          aggregateId,
        );
        if (current.object_key !== payload.objectKey)
          throw new WorkerJobError(
            'media scan object key does not match authoritative data',
            'JOB_PAYLOAD_INVALID',
            false,
          );
        if (current.quarantine_status === 'clean') return { original: current, done: true };
        if (current.quarantine_status === 'infected')
          throw new WorkerJobError(
            'media object is already marked infected',
            'MEDIA_UNSAFE',
            false,
          );
        if (current.quarantine_status === 'pending' || current.quarantine_status === 'error')
          await client.query(
            "update original_objects set quarantine_status = 'scanning' where id = $1",
            [aggregateId],
          );
        const media = await loadMedia(
          client,
          current.media_asset_id,
          context.job.organizationId,
          context.job.familyArchiveId!,
        );
        return {
          original: current,
          done: false,
          descriptor: {
            id: current.id,
            objectKey: current.object_key,
            contentType: current.content_type,
            byteSize: Number(current.byte_size),
            sha256Hex: current.sha256,
            kind: toMediaKind(media.media_type),
          },
        };
      },
    );
    original = loaded.original;
    if (loaded.done) return;
    descriptor = loaded.descriptor;
    const workDir = await mkdtemp(join(tmpdir(), 'family-historian-worker-'));
    try {
      const originalPath = join(workDir, 'original.bin');
      const actual = await options.storage.downloadToFile(original.object_key, originalPath);
      const expectedBase64 = Buffer.from(original.sha256, 'hex').toString('base64');
      if (actual.byteSize !== Number(original.byte_size) || actual.sha256Base64 !== expectedBase64)
        throw new WorkerJobError(
          'media object bytes do not match authoritative fixity',
          'CHECKSUM_MISMATCH',
          false,
        );

      const scratchPrefix = `worker-scratch/${original.id}`;
      const resolveObjectKey = (objectKey: string): string => {
        const candidate =
          objectKey === original.object_key ? originalPath : join(workDir, basename(objectKey));
        const resolved = resolve(candidate);
        const root = `${resolve(workDir)}${requirePathSeparator()}`;
        if (resolved !== resolve(workDir) && !resolved.startsWith(root))
          throw new WorkerJobError(
            'media worker path escapes scratch directory',
            'MEDIA_TOOL_INVALID',
            false,
          );
        return resolved;
      };
      const artifacts: {
        recipeVersion: string;
        bytes: Uint8Array;
        contentType: string;
      }[] = [];
      let totalDerivativeBytes = 0;
      for (const step of buildMediaPipelinePlan(descriptor)) {
        if (step.outputObjectKey && !step.outputObjectKey.startsWith(`${scratchPrefix}/`))
          throw new WorkerJobError(
            'media output path is outside the worker scratch prefix',
            'MEDIA_TOOL_INVALID',
            false,
          );
        await executeMediaPipelineStep(step, {
          cwd: workDir,
          resolveObjectKey,
          ...(options.binaries ? { binaries: options.binaries } : {}),
        });
        if (step.outputObjectKey) {
          const outputPath = resolveObjectKey(step.outputObjectKey);
          const outputSize = (await stat(outputPath)).size;
          if (outputSize > MAX_DERIVATIVE_BYTES)
            throw new WorkerJobError(
              'media derivative exceeds the per-artifact output ceiling',
              'MEDIA_OUTPUT_TOO_LARGE',
              false,
            );
          totalDerivativeBytes += outputSize;
          if (totalDerivativeBytes > MAX_TOTAL_DERIVATIVE_BYTES)
            throw new WorkerJobError(
              'media derivatives exceed the job output ceiling',
              'MEDIA_OUTPUT_TOO_LARGE',
              false,
            );
          artifacts.push({
            recipeVersion: step.name,
            bytes: await readFile(outputPath),
            contentType: derivativeContentType(step.outputObjectKey),
          });
        }
      }
      await context.withTenant(async (client) => {
        await ensureFixity(
          client,
          context.job.organizationId,
          context.job.familyArchiveId!,
          original.id,
          actual,
        );
        for (const artifact of artifacts)
          await storeDerivative(
            client,
            options.storage,
            context.job.organizationId,
            context.job.familyArchiveId!,
            original.id,
            artifact.recipeVersion,
            artifact.bytes,
            artifact.contentType,
          );
        await client.query(
          "update original_objects set quarantine_status = 'clean' where id = $1",
          [aggregateId],
        );
      });
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  } catch (error) {
    await context
      .withTenant(async (client) => {
        await client.query(
          "update original_objects set quarantine_status = 'error' where id = $1 and quarantine_status = 'scanning'",
          [aggregateId],
        );
      })
      .catch(() => undefined);
    if (error instanceof WorkerJobError) throw error;
    const code = error instanceof MediaExecutionError ? error.code : 'MEDIA_SCAN_FAILED';
    const retryable =
      code === 'MEDIA_TOOL_TIMEOUT' || code === 'MEDIA_TOOL_FAILED' || code === 'MEDIA_SCAN_FAILED';
    throw new WorkerJobError('media scan failed', code, retryable);
  }
}

async function loadOriginal(
  client: DatabaseClient,
  organizationId: string,
  familyArchiveId: string,
  id: string,
): Promise<{
  id: string;
  media_asset_id: string;
  object_key: string;
  content_type: string;
  byte_size: string;
  sha256: string;
  quarantine_status: string;
}> {
  const result = await client.query(
    `select id, media_asset_id, object_key, content_type, byte_size, sha256, quarantine_status
       from original_objects
      where id = $1 and organization_id = $2 and family_archive_id = $3`,
    [id, organizationId, familyArchiveId],
  );
  const row = result.rows[0] as
    | {
        id: string;
        media_asset_id: string;
        object_key: string;
        content_type: string;
        byte_size: string;
        sha256: string;
        quarantine_status: string;
      }
    | undefined;
  if (!row)
    throw new WorkerJobError(
      'media object is outside the worker scope',
      'PERMISSION_DENIED',
      false,
    );
  return row;
}

async function loadMedia(
  client: DatabaseClient,
  id: string,
  organizationId: string,
  familyArchiveId: string,
): Promise<{ media_type: string }> {
  const result = await client.query(
    'select media_type from media_assets where id = $1 and organization_id = $2 and family_archive_id = $3',
    [id, organizationId, familyArchiveId],
  );
  const row = result.rows[0] as { media_type: string } | undefined;
  if (!row)
    throw new WorkerJobError('media asset is outside the worker scope', 'PERMISSION_DENIED', false);
  return row;
}

function toMediaKind(value: string): MediaKind {
  if (value === 'audio' || value === 'video' || value === 'image' || value === 'document')
    return value;
  throw new WorkerJobError('media type is unsupported', 'MEDIA_TOOL_INVALID', false);
}

async function ensureFixity(
  client: DatabaseClient,
  organizationId: string,
  familyArchiveId: string,
  objectId: string,
  actual: { sha256Base64: string; byteSize: number },
): Promise<void> {
  const digest = Buffer.from(actual.sha256Base64, 'base64').toString('hex');
  const existing = await client.query(
    "select 1 from fixity_records where object_kind = 'original' and object_id = $1 and digest = $2 limit 1",
    [objectId, digest],
  );
  if (existing.rowCount === 1) return;
  await client.query(
    "insert into fixity_records(id, organization_id, family_archive_id, object_kind, object_id, algorithm, digest, byte_size, verified_at) values ($1,$2,$3,'original',$4,'sha256',$5,$6,now())",
    [uuidV7(), organizationId, familyArchiveId, objectId, digest, actual.byteSize],
  );
}

async function storeDerivative(
  client: DatabaseClient,
  storage: ObjectStorage,
  organizationId: string,
  familyArchiveId: string,
  originalObjectId: string,
  recipeVersion: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const existing = await client.query<{ id: string; sha256: string }>(
    'select id, sha256 from derivative_objects where original_object_id = $1 and recipe_version = $2 limit 1',
    [originalObjectId, recipeVersion],
  );
  const objectKey = derivativeObjectKey(originalObjectId, recipeVersion);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (existing.rowCount === 1) {
    if (existing.rows[0]?.sha256 !== digest)
      throw new WorkerJobError(
        'existing derivative fixity does not match the requested recipe output',
        'CHECKSUM_MISMATCH',
        false,
      );
    return;
  }
  const derivativeId = uuidV7();
  const expectedSha256 = Buffer.from(digest, 'hex').toString('base64');
  try {
    await storage.putOriginal(objectKey, bytes, contentType, expectedSha256);
  } catch (error) {
    // A previous attempt may have uploaded the immutable derivative before its
    // database transaction committed. Accept that exact object and let the
    // transaction retry the authoritative row insert; reject mismatches.
    try {
      const existing = await storage.head(objectKey);
      if (existing.byteSize !== bytes.byteLength || existing.expectedSha256 !== expectedSha256)
        throw error;
    } catch {
      throw error;
    }
  }
  const inserted = await client.query<{ id: string; sha256: string }>(
    `insert into derivative_objects(
       id, organization_id, family_archive_id, original_object_id, object_key, recipe_version, sha256
     ) values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (original_object_id, recipe_version) do nothing
     returning id, sha256`,
    [
      derivativeId,
      organizationId,
      familyArchiveId,
      originalObjectId,
      objectKey,
      recipeVersion,
      digest,
    ],
  );
  if (inserted.rowCount !== 1) {
    const concurrent = await client.query<{ sha256: string }>(
      'select sha256 from derivative_objects where original_object_id = $1 and recipe_version = $2 limit 1',
      [originalObjectId, recipeVersion],
    );
    if (concurrent.rows[0]?.sha256 !== digest)
      throw new WorkerJobError(
        'concurrent derivative fixity does not match the requested recipe output',
        'CHECKSUM_MISMATCH',
        false,
      );
    return;
  }
  await client.query(
    "insert into fixity_records(id, organization_id, family_archive_id, object_kind, object_id, algorithm, digest, byte_size, verified_at) values ($1,$2,$3,'derivative',$4,'sha256',$5,$6,now())",
    [uuidV7(), organizationId, familyArchiveId, derivativeId, digest, bytes.byteLength],
  );
}

function derivativeContentType(objectKey: string): string {
  if (objectKey.endsWith('.wav')) return 'audio/wav';
  if (objectKey.endsWith('.mp4')) return 'video/mp4';
  if (objectKey.endsWith('.jpg')) return 'image/jpeg';
  if (objectKey.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

function requirePathSeparator(): string {
  return process.platform === 'win32' ? '\\' : '/';
}
