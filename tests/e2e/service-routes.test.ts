import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArchiveService } from '../../apps/api/src/archive-service.js';
import { createApp } from '../../apps/api/src/app.js';
import { issueSessionToken } from '../../apps/api/src/session.js';
import {
  bootstrapArchive,
  createPool,
  migrate,
  uuidV7,
  withTenantTransaction,
} from '../../packages/database/src/index.js';
import { ObjectStorage, parseStorageConfig } from '../../packages/storage/src/index.js';

if (!process.env.DATABASE_URL) process.loadEnvFile('.env');
const sessionSecret = process.env.SESSION_SECRET ?? '';
const encryptionKey = process.env.FIELD_ENCRYPTION_MASTER_KEY ?? '';
const pool = createPool();
const storage = new ObjectStorage(parseStorageConfig(process.env));
const context = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
const foreignContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
const userId = uuidV7();
const foreignMediaId = uuidV7();
const service = new ArchiveService(pool, encryptionKey, storage);
const app = await createApp({ service, sessionSecret });
const token = issueSessionToken(sessionSecret, {
  userId,
  organizationId: context.organizationId,
  archiveIds: [context.familyArchiveId],
  permissions: ['archive:*'],
  expiresAt: Math.floor(Date.now() / 1000) + 300,
});

beforeAll(async () => {
  await migrate(pool);
  await bootstrapArchive(pool, context, 'API family', 'API archive');
  await bootstrapArchive(pool, foreignContext, 'Foreign family', 'Foreign archive');
  await withTenantTransaction(pool, foreignContext, async (client) => {
    await client.query(
      "insert into media_assets(id, organization_id, family_archive_id, media_type, rights_status) values ($1,$2,$3,'audio','verified')",
      [foreignMediaId, foreignContext.organizationId, foreignContext.familyArchiveId],
    );
  });
});
afterAll(async () => {
  await app.close();
  storage.destroy();
  await pool.end();
});

describe('authenticated archive service routes', () => {
  it('requires authentication with stable problem details', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/archives/${context.familyArchiveId}/people`,
    });
    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({ code: 'AUTH_REQUIRED', retryable: false });
  });

  it('encrypts restricted fields and replays one idempotent mutation', async () => {
    const key = `e2e-${uuidV7()}`;
    const request = {
      method: 'POST' as const,
      url: `/v1/archives/${context.familyArchiveId}/people`,
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
      payload: { displayName: 'Private Person', isLiving: true, visibility: 'owner_only' },
    };
    const first = await app.inject(request);
    const second = await app.inject(request);
    const firstBody = first.json<{ id: string }>();
    expect(first.statusCode).toBe(201);
    expect(first.headers['idempotency-replayed']).toBe('false');
    expect(second.headers['idempotency-replayed']).toBe('true');
    expect(second.json()).toEqual(firstBody);

    const stored = await withTenantTransaction(pool, context, async (client) =>
      client.query<{ display_name_encrypted: string }>(
        'select display_name_encrypted from people where id = $1',
        [firstBody.id],
      ),
    );
    expect(stored.rows[0]?.display_name_encrypted).not.toContain('Private Person');

    const listed = await app.inject({
      method: 'GET',
      url: `/v1/archives/${context.familyArchiveId}/people`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({ items: [{ id: firstBody.id }] });
  });

  it('rejects cross-archive references before creating provider uploads', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/archives/${context.familyArchiveId}/uploads`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `cross-scope-${uuidV7()}`,
      },
      payload: {
        mediaAssetId: foreignMediaId,
        contentType: 'audio/wav',
        byteSize: 1,
        sha256Hex: 'a'.repeat(64),
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('completes a signed multipart upload and verifies streamed object fixity', async () => {
    const media = await app.inject({
      method: 'POST',
      url: `/v1/archives/${context.familyArchiveId}/media`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `media-${uuidV7()}`,
      },
      payload: { mediaType: 'audio', visibility: 'owner_only', rightsStatus: 'verified' },
    });
    expect(media.statusCode).toBe(201);
    const mediaId = media.json<{ id: string }>().id;
    const bytes = new TextEncoder().encode('authenticated multipart fixity fixture');
    const sha256Hex = createHash('sha256').update(bytes).digest('hex');
    const begin = await app.inject({
      method: 'POST',
      url: `/v1/archives/${context.familyArchiveId}/uploads`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `upload-${uuidV7()}`,
      },
      payload: {
        mediaAssetId: mediaId,
        contentType: 'audio/wav',
        byteSize: bytes.byteLength,
        sha256Hex,
      },
    });
    expect(begin.statusCode).toBe(201);
    const uploadId = begin.json<{ id: string }>().id;
    const signed = await app.inject({
      method: 'GET',
      url: `/v1/archives/${context.familyArchiveId}/uploads/${uploadId}/parts/1`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(signed.statusCode).toBe(200);
    const signedUrl = signed.json<{ url: string }>().url;
    const uploaded = await fetch(signedUrl, { method: 'PUT', body: bytes });
    const uploadBody = await uploaded.text();
    expect(uploaded.ok, `multipart upload failed: ${uploaded.status} ${uploadBody}`).toBe(true);
    const etag = uploaded.headers.get('etag');
    expect(etag).toBeTruthy();
    const resumableStatus = await app.inject({
      method: 'GET',
      url: `/v1/archives/${context.familyArchiveId}/uploads/${uploadId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(resumableStatus.statusCode).toBe(200);
    expect(resumableStatus.json()).toMatchObject({
      id: uploadId,
      status: 'initiated',
      parts: [{ partNumber: 1, byteSize: bytes.byteLength }],
    });
    const complete = await app.inject({
      method: 'POST',
      url: `/v1/archives/${context.familyArchiveId}/uploads/${uploadId}/complete`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `complete-${uuidV7()}`,
      },
      payload: { parts: [{ ETag: etag, PartNumber: 1 }] },
    });
    expect(complete.statusCode).toBe(200);
    expect(complete.json()).toMatchObject({ id: uploadId, status: 'completed' });

    const persisted = await withTenantTransaction(pool, context, async (client) =>
      client.query<{ object_key: string; sha256: string }>(
        'select object_key, sha256 from original_objects where media_asset_id = $1',
        [mediaId],
      ),
    );
    expect(persisted.rows).toHaveLength(1);
    expect(persisted.rows[0]?.sha256).toBe(sha256Hex);
    await storage.delete(persisted.rows[0]!.object_key);
  });
});
