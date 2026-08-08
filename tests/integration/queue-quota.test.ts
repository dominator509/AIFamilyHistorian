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
const concurrentContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
const actorUserId = uuidV7();
const service = new ArchiveService(pool, 'a'.repeat(32));

beforeAll(async () => {
  await migrate(pool);
  await bootstrapArchive(pool, context, 'Queue family', 'Queue archive');
  await bootstrapArchive(
    pool,
    concurrentContext,
    'Concurrent queue family',
    'Concurrent queue archive',
  );
  await withTenantTransaction(pool, context, async (client) => {
    for (let index = 0; index < 1_000; index += 1)
      await client.query(
        'insert into job_outbox(id, organization_id, family_archive_id, job_type, payload) values ($1,$2,$3,$4,$5)',
        [uuidV7(), context.organizationId, context.familyArchiveId, 'privacy.request', {}],
      );
  });
  await withTenantTransaction(pool, concurrentContext, async (client) => {
    for (let index = 0; index < 999; index += 1)
      await client.query(
        'insert into job_outbox(id, organization_id, family_archive_id, job_type, payload) values ($1,$2,$3,$4,$5)',
        [
          uuidV7(),
          concurrentContext.organizationId,
          concurrentContext.familyArchiveId,
          'privacy.request',
          {},
        ],
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

  it('serializes concurrent enqueue decisions at the archive capacity boundary', async () => {
    const results = await Promise.allSettled(
      [0, 1].map((index) =>
        service.create(
          concurrentContext,
          actorUserId,
          `concurrent-queue-${index}-${uuidV7()}`,
          '/v1/privacy-requests',
          {
            kind: 'privacy-requests',
            input: {
              archiveId: concurrentContext.familyArchiveId,
              requestType: 'access',
              requesterReference: `concurrent queue ${index}`,
            },
          },
        ),
      ),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const count = await pool.query<{ count: number }>(
      "select count(*)::int as count from job_outbox where organization_id = $1 and family_archive_id = $2 and status in ('queued', 'running', 'retryable_failed')",
      [concurrentContext.organizationId, concurrentContext.familyArchiveId],
    );
    expect(count.rows[0]?.count).toBe(1_000);
  });
});
