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
const service = new ArchiveService(pool, 'a'.repeat(32));

beforeAll(async () => {
  await migrate(pool);
  await bootstrapArchive(pool, context, 'Queue family', 'Queue archive');
  await withTenantTransaction(pool, context, async (client) => {
    for (let index = 0; index < 1_000; index += 1)
      await client.query(
        'insert into job_outbox(id, organization_id, family_archive_id, job_type, payload) values ($1,$2,$3,$4,$5)',
        [uuidV7(), context.organizationId, context.familyArchiveId, 'privacy.request', {}],
      );
  });
});

afterAll(async () => {
  await pool.end();
});

describe('archive queue quotas', () => {
  it('rejects new queued work at the archive capacity boundary', async () => {
    await expect(
      service.create(context, actorUserId, 'queue-quota-idempotency-key', '/v1/privacy-requests', {
        kind: 'privacy-requests',
        input: {
          archiveId: context.familyArchiveId,
          requestType: 'access',
          requesterReference: 'queue quota fixture',
        },
      }),
    ).rejects.toMatchObject<ApiProblem>({ code: 'QUOTA_EXCEEDED' });
  });
});
