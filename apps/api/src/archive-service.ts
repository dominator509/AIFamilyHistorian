import { createHash } from 'node:crypto';
import type { z } from 'zod';
import type {
  billingInputSchema,
  chapterInputSchema,
  editionInputSchema,
  eventInputSchema,
  exportInputSchema,
  factInputSchema,
  mediaInputSchema,
  memberInputSchema,
  narrationInputSchema,
  personInputSchema,
  privacyRequestInputSchema,
  recordingSessionInputSchema,
  rightsInputSchema,
  shareInputSchema,
  transcriptInputSchema,
  MutationResponse,
} from '@family-historian/contracts';
import { roleSchema } from '@family-historian/contracts';
import { uuidV7, withIdempotentMutation, withTenantTransaction } from '@family-historian/database';
import {
  originalObjectKey,
  type CompletedUploadPart,
  type ObjectStorage,
} from '@family-historian/storage';
import type { DatabaseClient, DatabaseContext, DatabasePool } from '@family-historian/database';
import { encryptRestrictedText } from './encryption.js';
import { ApiProblem } from './problems.js';

type ResourceMutation =
  | { kind: 'members'; input: z.infer<typeof memberInputSchema> }
  | { kind: 'recording-sessions'; input: z.infer<typeof recordingSessionInputSchema> }
  | { kind: 'media'; input: z.infer<typeof mediaInputSchema> }
  | { kind: 'transcripts'; input: z.infer<typeof transcriptInputSchema> }
  | { kind: 'people'; input: z.infer<typeof personInputSchema> }
  | { kind: 'events'; input: z.infer<typeof eventInputSchema> }
  | { kind: 'facts'; input: z.infer<typeof factInputSchema> }
  | { kind: 'chapters'; input: z.infer<typeof chapterInputSchema> }
  | { kind: 'editions'; input: z.infer<typeof editionInputSchema> }
  | { kind: 'narration'; input: z.infer<typeof narrationInputSchema> }
  | { kind: 'shares'; input: z.infer<typeof shareInputSchema> }
  | { kind: 'exports'; input: z.infer<typeof exportInputSchema> }
  | { kind: 'rights'; input: z.infer<typeof rightsInputSchema> }
  | { kind: 'privacy-requests'; input: z.infer<typeof privacyRequestInputSchema> }
  | { kind: 'billing'; input: z.infer<typeof billingInputSchema> };

export type ListResourceKind = Exclude<ResourceMutation['kind'], 'privacy-requests' | 'billing'>;

const MAX_ACTIVE_UPLOADS_PER_USER = 8;
const MAX_ACTIVE_UPLOAD_BYTES_PER_USER = 25 * 1024 * 1024 * 1024;
const MAX_ACTIVE_UPLOAD_BYTES_PER_ARCHIVE = 50 * 1024 * 1024 * 1024;
const MAX_PENDING_JOBS_PER_ARCHIVE = 1_000;

const tableByKind: Record<ListResourceKind, string> = {
  members: 'memberships',
  'recording-sessions': 'recording_sessions',
  media: 'media_assets',
  transcripts: 'transcripts',
  people: 'people',
  events: 'life_events',
  facts: 'confirmed_facts',
  chapters: 'chapters',
  editions: 'editions',
  narration: 'narration_jobs',
  shares: 'portal_shares',
  exports: 'export_jobs',
  rights: 'rights_claims',
};

export class ArchiveService {
  public constructor(
    private readonly pool: DatabasePool,
    private readonly fieldEncryptionMasterKey: string,
    private readonly storage?: ObjectStorage,
  ) {}

  public async ready(): Promise<boolean> {
    try {
      await this.pool.query('select 1');
      return true;
    } catch {
      return false;
    }
  }

  public async getArchive(context: DatabaseContext): Promise<{ id: string; name: string } | null> {
    return withTenantTransaction(this.pool, context, async (client) => {
      const result = await client.query<{ id: string; name: string }>(
        'select id, name from family_archives where id = $1',
        [context.familyArchiveId],
      );
      return result.rows[0] ?? null;
    });
  }

  public async list(
    kind: ListResourceKind,
    context: DatabaseContext,
  ): Promise<readonly { id: string }[]> {
    const table = tableByKind[kind];
    return withTenantTransaction(this.pool, context, async (client) => {
      const result = await client.query<{ id: string }>(
        `select id from ${table} order by created_at, id limit 200`,
      );
      return result.rows;
    });
  }

  public async create(
    context: DatabaseContext,
    actorUserId: string,
    idempotencyKey: string,
    route: string,
    mutation: ResourceMutation,
  ): Promise<{ response: MutationResponse; replayed: boolean }> {
    const id = uuidV7();
    const actorPseudonym = createHash('sha256').update(actorUserId, 'utf8').digest('hex');
    const result = await withIdempotentMutation(
      this.pool,
      {
        ...context,
        idempotencyKey,
        method: 'POST',
        route,
        actorPseudonym,
        action: `${mutation.kind}.create`,
      },
      async (client) => {
        const scope = [id, context.organizationId, context.familyArchiveId] as const;
        switch (mutation.kind) {
          case 'members':
            await this.assertMemberManagementPermission(client, context, actorUserId);
            if (
              mutation.input.role === 'organization_owner' ||
              mutation.input.role === 'platform_admin'
            )
              throw new ApiProblem(
                'PERMISSION_DENIED',
                'Organization and platform roles require an explicit administrative workflow',
              );
            await client.query(
              'insert into memberships(id, organization_id, family_archive_id, user_id, role) values ($1,$2,$3,$4,$5)',
              [...scope, mutation.input.userId, mutation.input.role],
            );
            break;
          case 'recording-sessions':
            if (mutation.input.subjectId)
              await this.assertScopedIds(
                client,
                context,
                'people',
                [mutation.input.subjectId],
                'subject',
              );
            await client.query(
              'insert into recording_sessions(id, organization_id, family_archive_id, subject_id, scheduled_at, status) values ($1,$2,$3,$4,$5,$6)',
              [
                ...scope,
                mutation.input.subjectId ?? null,
                mutation.input.scheduledAt ?? null,
                'scheduled',
              ],
            );
            break;
          case 'media':
            if (mutation.input.rightsStatus !== 'pending')
              throw new ApiProblem('VALIDATION_FAILED', 'New media must begin with pending rights');
            await client.query(
              'insert into media_assets(id, organization_id, family_archive_id, media_type, visibility, rights_status) values ($1,$2,$3,$4,$5,$6)',
              [
                ...scope,
                mutation.input.mediaType,
                mutation.input.visibility,
                mutation.input.rightsStatus,
              ],
            );
            break;
          case 'transcripts': {
            await this.assertScopedIds(
              client,
              context,
              'media_assets',
              [mutation.input.mediaAssetId],
              'media asset',
            );
            const revisionId = uuidV7();
            await client.query(
              'insert into transcripts(id, organization_id, family_archive_id, media_asset_id) values ($1,$2,$3,$4)',
              [...scope, mutation.input.mediaAssetId],
            );
            await client.query(
              'insert into transcript_revisions(id, organization_id, family_archive_id, media_asset_id, status, encrypted_text, approved_at) values ($1,$2,$3,$4,$5,$6,$7)',
              [
                revisionId,
                context.organizationId,
                context.familyArchiveId,
                mutation.input.mediaAssetId,
                mutation.input.status,
                encryptRestrictedText(this.fieldEncryptionMasterKey, mutation.input.text),
                mutation.input.status === 'approved' ? new Date() : null,
              ],
            );
            await client.query('update transcripts set current_revision_id = $1 where id = $2', [
              revisionId,
              id,
            ]);
            break;
          }
          case 'people':
            await client.query(
              'insert into people(id, organization_id, family_archive_id, display_name_encrypted, is_living, visibility) values ($1,$2,$3,$4,$5,$6)',
              [
                ...scope,
                encryptRestrictedText(this.fieldEncryptionMasterKey, mutation.input.displayName),
                mutation.input.isLiving,
                mutation.input.visibility,
              ],
            );
            break;
          case 'events':
            await this.assertScopedIds(
              client,
              context,
              'people',
              mutation.input.personId ? [mutation.input.personId] : [],
              'person',
            );
            await this.assertScopedIds(
              client,
              context,
              'places',
              mutation.input.placeId ? [mutation.input.placeId] : [],
              'place',
            );
            await client.query(
              'insert into life_events(id, organization_id, family_archive_id, person_id, place_id, event_type, date_precision, occurred_on, description_encrypted, visibility) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
              [
                ...scope,
                mutation.input.personId ?? null,
                mutation.input.placeId ?? null,
                mutation.input.eventType,
                mutation.input.datePrecision,
                mutation.input.occurredOn ?? null,
                mutation.input.description
                  ? encryptRestrictedText(this.fieldEncryptionMasterKey, mutation.input.description)
                  : null,
                mutation.input.visibility,
              ],
            );
            break;
          case 'facts': {
            await this.assertScopedIds(
              client,
              context,
              'evidence_links',
              mutation.input.evidenceLinkIds,
              'evidence link',
              'EVIDENCE_MISSING',
            );
            await client.query(
              'insert into confirmed_facts(id, organization_id, family_archive_id, encrypted_text, confirmer_id, status) values ($1,$2,$3,$4,$5,$6)',
              [
                ...scope,
                encryptRestrictedText(this.fieldEncryptionMasterKey, mutation.input.text),
                mutation.input.confirmerId,
                mutation.input.status,
              ],
            );
            for (const evidenceLinkId of mutation.input.evidenceLinkIds) {
              await client.query(
                'insert into fact_evidence(id, organization_id, family_archive_id, fact_id, evidence_link_id) values ($1,$2,$3,$4,$5)',
                [uuidV7(), context.organizationId, context.familyArchiveId, id, evidenceLinkId],
              );
            }
            break;
          }
          case 'chapters':
            await client.query(
              'insert into chapters(id, organization_id, family_archive_id, title_encrypted) values ($1,$2,$3,$4)',
              [
                ...scope,
                encryptRestrictedText(this.fieldEncryptionMasterKey, mutation.input.title),
              ],
            );
            break;
          case 'editions':
            await client.query(
              'insert into editions(id, organization_id, family_archive_id, edition_hash, manifest) values ($1,$2,$3,$4,$5)',
              [...scope, mutation.input.editionHash, mutation.input.manifest],
            );
            break;
          case 'narration':
            await this.assertScopedIds(
              client,
              context,
              'editions',
              [mutation.input.editionId],
              'edition',
            );
            await this.assertScopedIds(
              client,
              context,
              'voice_authorizations',
              [mutation.input.voiceAuthorizationId],
              'voice authorization',
            );
            await client.query(
              "insert into narration_jobs(id, organization_id, family_archive_id, edition_id, voice_authorization_id, status, idempotency_key) values ($1,$2,$3,$4,$5,'queued',$6)",
              [
                ...scope,
                mutation.input.editionId,
                mutation.input.voiceAuthorizationId,
                idempotencyKey,
              ],
            );
            await this.enqueue(client, context, 'narration.generate', id, mutation.input);
            break;
          case 'shares':
            await client.query(
              'insert into portal_shares(id, organization_id, family_archive_id, token_hash, visibility, expires_at) values ($1,$2,$3,$4,$5,$6)',
              [
                ...scope,
                mutation.input.tokenHash,
                mutation.input.visibility,
                mutation.input.expiresAt,
              ],
            );
            break;
          case 'exports':
            await client.query(
              "insert into export_jobs(id, organization_id, family_archive_id, status, idempotency_key) values ($1,$2,$3,'queued',$4)",
              [...scope, idempotencyKey],
            );
            await this.enqueue(
              client,
              context,
              `export.${mutation.input.kind}`,
              id,
              mutation.input,
            );
            break;
          case 'rights':
            if (mutation.input.status !== 'pending')
              throw new ApiProblem('VALIDATION_FAILED', 'New rights claims must begin as pending');
            await this.assertRightsSubjectScoped(
              client,
              context,
              mutation.input.subjectType,
              mutation.input.subjectId,
            );
            await client.query(
              'insert into rights_claims(id, organization_id, family_archive_id, subject_type, subject_id, basis, status) values ($1,$2,$3,$4,$5,$6,$7)',
              [
                ...scope,
                mutation.input.subjectType,
                mutation.input.subjectId,
                mutation.input.basis,
                mutation.input.status,
              ],
            );
            break;
          case 'privacy-requests':
            await client.query(
              "insert into privacy_requests(id, organization_id, family_archive_id, request_type, status, requester_reference, due_at) values ($1,$2,$3,$4,'queued',$5,now() + interval '30 days')",
              [
                id,
                context.organizationId,
                mutation.input.archiveId ?? context.familyArchiveId,
                mutation.input.requestType,
                mutation.input.requesterReference,
              ],
            );
            await this.enqueue(client, context, 'privacy.request', id, mutation.input);
            break;
          case 'billing':
            if (mutation.input.status !== 'trialing')
              throw new ApiProblem(
                'PERMISSION_DENIED',
                'Subscription status changes require a verified provider event',
              );
            await client.query(
              'insert into subscriptions(id, organization_id, plan_code, status) values ($1,$2,$3,$4)',
              [id, context.organizationId, mutation.input.planCode, 'trialing'],
            );
            break;
        }
        return { status: 201, body: { id, status: 'accepted' } };
      },
    );
    return { response: result.body, replayed: result.replayed };
  }

  public async beginUpload(
    context: DatabaseContext,
    actorUserId: string,
    idempotencyKey: string,
    input: {
      mediaAssetId: string;
      contentType: string;
      byteSize: number;
      sha256Hex: string;
    },
  ): Promise<{ response: MutationResponse; replayed: boolean }> {
    const storage = this.requireStorage();
    const id = uuidV7();
    const objectKey = originalObjectKey(context.organizationId, context.familyArchiveId);
    const sha256Base64 = Buffer.from(input.sha256Hex, 'hex').toString('base64');
    let providerUploadId: string | undefined;
    try {
      const result = await withIdempotentMutation(
        this.pool,
        {
          ...context,
          idempotencyKey,
          method: 'POST',
          route: '/v1/archives/:archiveId/uploads',
          actorPseudonym: this.actorPseudonym(actorUserId),
          action: 'upload.begin',
        },
        async (client) => {
          await this.assertScopedIds(
            client,
            context,
            'media_assets',
            [input.mediaAssetId],
            'media asset',
          );
          await this.assertUploadQuota(client, context, actorUserId, input.byteSize);
          providerUploadId = await storage.beginMultipart(
            objectKey,
            input.contentType,
            sha256Base64,
          );
          await client.query(
            "insert into upload_sessions(id, organization_id, family_archive_id, initiated_by_user_id, media_asset_id, object_key, provider_upload_id, content_type, expected_byte_size, expected_sha256_hex, expected_sha256_base64, status) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'initiated')",
            [
              id,
              context.organizationId,
              context.familyArchiveId,
              actorUserId,
              input.mediaAssetId,
              objectKey,
              providerUploadId,
              input.contentType,
              input.byteSize,
              input.sha256Hex,
              sha256Base64,
            ],
          );
          return { status: 201, body: { id, status: 'initiated' } };
        },
      );
      return { response: result.body, replayed: result.replayed };
    } catch (error) {
      if (providerUploadId)
        await storage.abortMultipart(objectKey, providerUploadId).catch(() => undefined);
      throw error;
    }
  }

  public async signUploadPart(
    context: DatabaseContext,
    uploadId: string,
    partNumber: number,
  ): Promise<{ url: string; expiresIn: number }> {
    const upload = await this.upload(context, uploadId);
    if (upload.status !== 'initiated')
      throw new ApiProblem('UPLOAD_INCOMPLETE', 'Upload is not accepting parts');
    const expiresIn = 900;
    return {
      url: await this.requireStorage().signUploadPart(
        upload.object_key,
        upload.provider_upload_id,
        partNumber,
        expiresIn,
      ),
      expiresIn,
    };
  }

  public async uploadStatus(
    context: DatabaseContext,
    uploadId: string,
  ): Promise<{
    id: string;
    status: string;
    expectedByteSize: number;
    parts: readonly { partNumber: number; etag: string; byteSize: number }[];
  }> {
    const upload = await this.upload(context, uploadId);
    const parts =
      upload.status === 'initiated'
        ? await this.requireStorage().listMultipartParts(
            upload.object_key,
            upload.provider_upload_id,
          )
        : [];
    return {
      id: upload.id,
      status: upload.status,
      expectedByteSize: Number(upload.expected_byte_size),
      parts,
    };
  }

  public async completeUpload(
    context: DatabaseContext,
    actorUserId: string,
    idempotencyKey: string,
    uploadId: string,
    parts: readonly {
      ETag: string;
      PartNumber: number;
      ChecksumSHA256?: string;
    }[],
  ): Promise<{ response: MutationResponse; replayed: boolean }> {
    const storage = this.requireStorage();
    const result = await withIdempotentMutation(
      this.pool,
      {
        ...context,
        idempotencyKey,
        method: 'POST',
        route: '/v1/archives/:archiveId/uploads/:uploadId/complete',
        actorPseudonym: this.actorPseudonym(actorUserId),
        action: 'upload.complete',
      },
      async (client) => {
        const upload = await this.uploadWithClient(client, uploadId);
        if (upload.status !== 'initiated')
          throw new ApiProblem('CONFLICT', 'Upload has already reached a terminal state');
        try {
          const storageParts: CompletedUploadPart[] = parts.map((part) => ({
            ETag: part.ETag,
            PartNumber: part.PartNumber,
            ...(part.ChecksumSHA256 ? { ChecksumSHA256: part.ChecksumSHA256 } : {}),
          }));
          await storage.completeMultipart(
            upload.object_key,
            upload.provider_upload_id,
            storageParts,
          );
        } catch (error) {
          await storage.head(upload.object_key).catch(() => {
            throw error;
          });
        }
        const head = await storage.head(upload.object_key);
        if (head.byteSize !== Number(upload.expected_byte_size))
          throw new ApiProblem('CHECKSUM_MISMATCH', 'Completed object size does not match');
        if (head.expectedSha256 !== upload.expected_sha256_base64)
          throw new ApiProblem(
            'CHECKSUM_MISMATCH',
            'Completed object checksum metadata does not match',
          );
        if (head.contentType && head.contentType.toLowerCase() !== upload.content_type)
          throw new ApiProblem(
            'MEDIA_UNSAFE',
            'Completed object content type does not match upload intent',
          );
        const actual = await storage.sha256Base64(upload.object_key);
        if (
          actual.byteSize !== Number(upload.expected_byte_size) ||
          actual.sha256Base64 !== upload.expected_sha256_base64
        )
          throw new ApiProblem('CHECKSUM_MISMATCH', 'Completed object bytes do not match checksum');
        const originalObjectId = uuidV7();
        await client.query(
          "insert into original_objects(id, organization_id, family_archive_id, media_asset_id, object_key, content_type, byte_size, sha256, quarantine_status) values ($1,$2,$3,$4,$5,$6,$7,$8,'pending')",
          [
            originalObjectId,
            context.organizationId,
            context.familyArchiveId,
            upload.media_asset_id,
            upload.object_key,
            upload.content_type,
            upload.expected_byte_size,
            upload.expected_sha256_hex,
          ],
        );
        await client.query(
          "update upload_sessions set status = 'completed', original_object_id = $1, completed_at = now() where id = $2",
          [originalObjectId, uploadId],
        );
        await client.query(
          'insert into usage_ledger(id, organization_id, family_archive_id, category, quantity, unit, idempotency_key, recorded_at) values ($1,$2,$3,$4,$5,$6,$7,now())',
          [
            uuidV7(),
            context.organizationId,
            context.familyArchiveId,
            'storage_bytes',
            upload.expected_byte_size,
            'bytes',
            `storage:${originalObjectId}`,
          ],
        );
        await this.enqueue(client, context, 'media.scan', originalObjectId, {
          objectKey: upload.object_key,
        });
        return { status: 200, body: { id: uploadId, status: 'completed' } };
      },
    );
    return { response: result.body, replayed: result.replayed };
  }

  public async abortUpload(
    context: DatabaseContext,
    actorUserId: string,
    idempotencyKey: string,
    uploadId: string,
  ): Promise<{ response: MutationResponse; replayed: boolean }> {
    const storage = this.requireStorage();
    const result = await withIdempotentMutation(
      this.pool,
      {
        ...context,
        idempotencyKey,
        method: 'POST',
        route: '/v1/archives/:archiveId/uploads/:uploadId/abort',
        actorPseudonym: this.actorPseudonym(actorUserId),
        action: 'upload.abort',
      },
      async (client) => {
        const upload = await this.uploadWithClient(client, uploadId);
        if (upload.status === 'completed')
          throw new ApiProblem('CONFLICT', 'Completed uploads cannot be aborted');
        if (upload.status === 'initiated') {
          await storage.abortMultipart(upload.object_key, upload.provider_upload_id);
          await client.query("update upload_sessions set status = 'aborted' where id = $1", [
            uploadId,
          ]);
        }
        return { status: 200, body: { id: uploadId, status: 'aborted' } };
      },
    );
    return { response: result.body, replayed: result.replayed };
  }

  private actorPseudonym(userId: string): string {
    return createHash('sha256').update(userId, 'utf8').digest('hex');
  }

  private async assertMemberManagementPermission(
    client: DatabaseClient,
    context: DatabaseContext,
    actorUserId: string,
  ): Promise<void> {
    const result = await client.query<{ role: string }>(
      'select role from memberships where organization_id = $1 and family_archive_id = $2 and user_id = $3 limit 1',
      [context.organizationId, context.familyArchiveId, actorUserId],
    );
    const role = result.rows[0] ? roleSchema.safeParse(result.rows[0].role) : null;
    if (!role?.success || !['organization_owner', 'archive_owner'].includes(role.data))
      throw new ApiProblem('PERMISSION_DENIED', 'Only archive owners can manage members');
  }

  private async assertUploadQuota(
    client: DatabaseClient,
    context: DatabaseContext,
    actorUserId: string,
    additionalBytes: number,
  ): Promise<void> {
    const userResult = await client.query<{ active_count: string; active_bytes: string }>(
      "select count(*)::text as active_count, coalesce(sum(expected_byte_size), 0)::text as active_bytes from upload_sessions where organization_id = $1 and family_archive_id = $2 and initiated_by_user_id = $3 and status = 'initiated'",
      [context.organizationId, context.familyArchiveId, actorUserId],
    );
    const archiveResult = await client.query<{ active_bytes: string }>(
      "select coalesce(sum(expected_byte_size), 0)::text as active_bytes from upload_sessions where organization_id = $1 and family_archive_id = $2 and status = 'initiated'",
      [context.organizationId, context.familyArchiveId],
    );
    const activeCount = Number(userResult.rows[0]?.active_count ?? 0);
    const activeUserBytes = Number(userResult.rows[0]?.active_bytes ?? 0);
    const activeArchiveBytes = Number(archiveResult.rows[0]?.active_bytes ?? 0);
    if (activeCount >= MAX_ACTIVE_UPLOADS_PER_USER)
      throw new ApiProblem('QUOTA_EXCEEDED', 'Too many active uploads for this user');
    if (activeUserBytes + additionalBytes > MAX_ACTIVE_UPLOAD_BYTES_PER_USER)
      throw new ApiProblem('QUOTA_EXCEEDED', 'Active upload bytes exceed the user quota');
    if (activeArchiveBytes + additionalBytes > MAX_ACTIVE_UPLOAD_BYTES_PER_ARCHIVE)
      throw new ApiProblem('QUOTA_EXCEEDED', 'Active upload bytes exceed the archive quota');
  }

  private async assertRightsSubjectScoped(
    client: DatabaseClient,
    context: DatabaseContext,
    subjectType: string,
    subjectId: string,
  ): Promise<void> {
    const tableBySubjectType: Record<string, string> = {
      person: 'people',
      people: 'people',
      media: 'media_assets',
      media_asset: 'media_assets',
      edition: 'editions',
      editions: 'editions',
      voice_authorization: 'voice_authorizations',
      voice_authorizations: 'voice_authorizations',
    };
    const table = tableBySubjectType[subjectType.toLowerCase()];
    if (!table) throw new ApiProblem('VALIDATION_FAILED', 'Rights subject type is not supported');
    await this.assertScopedIds(client, context, table, [subjectId], 'rights subject');
  }

  private async assertScopedIds(
    client: DatabaseClient,
    context: DatabaseContext,
    table: string,
    ids: readonly string[],
    label: string,
    problemCode: 'PERMISSION_DENIED' | 'EVIDENCE_MISSING' = 'PERMISSION_DENIED',
  ): Promise<void> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return;
    if (uniqueIds.length !== ids.length)
      throw new ApiProblem(problemCode, `${label} identifiers must be unique`);
    const result = await client.query<{ id: string }>(
      `select id from ${table} where id = any($1::uuid[]) and organization_id = $2 and family_archive_id = $3`,
      [uniqueIds, context.organizationId, context.familyArchiveId],
    );
    if (result.rowCount !== uniqueIds.length)
      throw new ApiProblem(
        problemCode,
        problemCode === 'EVIDENCE_MISSING'
          ? 'Every confirmed fact requires valid evidence'
          : `${label} is outside the authorized archive scope`,
      );
  }

  private requireStorage(): ObjectStorage {
    if (!this.storage)
      throw new ApiProblem('PROVIDER_UNAVAILABLE', 'Object storage is not configured', true);
    return this.storage;
  }

  private async upload(context: DatabaseContext, uploadId: string): Promise<UploadRow> {
    return withTenantTransaction(this.pool, context, (client) =>
      this.uploadWithClient(client, uploadId),
    );
  }

  private async uploadWithClient(client: DatabaseClient, uploadId: string): Promise<UploadRow> {
    const result = await client.query<UploadRow>(
      'select id, media_asset_id, object_key, provider_upload_id, content_type, expected_byte_size, expected_sha256_hex, expected_sha256_base64, status from upload_sessions where id = $1',
      [uploadId],
    );
    const upload = result.rows[0];
    if (!upload) throw new ApiProblem('UPLOAD_INCOMPLETE', 'Upload session was not found');
    return upload;
  }

  private async enqueue(
    client: DatabaseClient,
    context: DatabaseContext,
    jobType: string,
    aggregateId: string,
    payload: unknown,
  ): Promise<void> {
    const pending = await client.query<{ count: string }>(
      "select count(*)::text as count from job_outbox where organization_id = $1 and family_archive_id = $2 and status in ('queued', 'running', 'retryable_failed')",
      [context.organizationId, context.familyArchiveId],
    );
    if (Number(pending.rows[0]?.count ?? 0) >= MAX_PENDING_JOBS_PER_ARCHIVE)
      throw new ApiProblem('QUOTA_EXCEEDED', 'Archive job queue capacity has been reached');
    await client.query(
      'insert into job_outbox(id, organization_id, family_archive_id, job_type, payload) values ($1,$2,$3,$4,$5)',
      [
        uuidV7(),
        context.organizationId,
        context.familyArchiveId,
        jobType,
        { aggregateId, payload },
      ],
    );
  }
}

interface UploadRow {
  id: string;
  media_asset_id: string;
  object_key: string;
  provider_upload_id: string;
  content_type: string;
  expected_byte_size: string;
  expected_sha256_hex: string;
  expected_sha256_base64: string;
  status: string;
}
