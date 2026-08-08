import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArchiveService } from '../../apps/api/src/archive-service.js';
import {
  bootstrapArchive,
  createPool,
  migrate,
  uuidV7,
  withTenantTransaction,
} from '../../packages/database/src/index.js';
import type { ApiProblem } from '../../apps/api/src/problems.js';

if (!process.env.DATABASE_URL) process.loadEnvFile('.env');
const pool = createPool();
const context = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
const actorUserId = uuidV7();
let providerCalls = 0;
const storage = {
  beginMultipart: () => Promise.resolve(`provider-upload-${++providerCalls}`),
} as never;
const service = new ArchiveService(pool, 'a'.repeat(32), storage);

beforeAll(async () => {
  await migrate(pool);
  await bootstrapArchive(pool, context, 'Quota family', 'Quota archive');
  await withTenantTransaction(pool, context, async (client) => {
    await client.query(
      "insert into media_assets(id, organization_id, family_archive_id, media_type, rights_status) values ($1,$2,$3,'audio','pending')",
      [uuidV7(), context.organizationId, context.familyArchiveId],
    );
  });
});

afterAll(async () => {
  await pool.end();
});

describe('active upload quotas', () => {
  it('rejects the ninth active upload for one user before the provider call', async () => {
    const media = await withTenantTransaction(pool, context, async (client) =>
      client.query<{ id: string }>('select id from media_assets limit 1'),
    );
    const mediaAssetId = media.rows[0]!.id;
    for (let index = 0; index < 8; index += 1) {
      await service.beginUpload(context, actorUserId, `quota-upload-${index}-unique`, {
        mediaAssetId,
        contentType: 'audio/wav',
        byteSize: 1,
        sha256Hex: 'a'.repeat(64),
      });
    }
    await expect(
      service.beginUpload(context, actorUserId, 'quota-upload-ninth-unique', {
        mediaAssetId,
        contentType: 'audio/wav',
        byteSize: 1,
        sha256Hex: 'a'.repeat(64),
      }),
    ).rejects.toMatchObject<ApiProblem>({ code: 'QUOTA_EXCEEDED' });
    expect(providerCalls).toBe(8);
  });
});
