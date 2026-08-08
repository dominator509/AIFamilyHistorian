import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { ArchiveService } from '../../apps/api/src/archive-service.js';
import {
  bootstrapArchive,
  createPool,
  migrate,
  uuidV7,
  type DatabaseContext,
} from '../../packages/database/src/index.js';
import type { ApiProblem } from '../../apps/api/src/problems.js';

if (!process.env.DATABASE_URL) process.loadEnvFile('.env');
const pool = createPool();
const service = new ArchiveService(pool, 'a'.repeat(32));

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('billing trust boundary', () => {
  it('rejects client-controlled provider states', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Billing family', 'Billing archive');
    await expect(
      service.create(context, uuidV7(), 'billing-active-rejected', '/v1/billing', {
        kind: 'billing',
        input: { planCode: 'self_service', status: 'active' },
      }),
    ).rejects.toMatchObject<ApiProblem>({ code: 'PERMISSION_DENIED' });
    const rows = await pool.query<{ count: number }>(
      'select count(*)::int as count from subscriptions where organization_id = $1',
      [context.organizationId],
    );
    expect(rows.rows[0]?.count).toBe(0);
  });

  it('creates only a valid trial subscription and blocks a second current subscription', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Billing trial family', 'Billing trial archive');
    await expect(
      service.create(context, uuidV7(), 'billing-trial-subscription', '/v1/billing', {
        kind: 'billing',
        input: { planCode: 'family', status: 'trialing' },
      }),
    ).resolves.toMatchObject({ response: { status: 'accepted' }, replayed: false });
    const subscription = await pool.query<{ plan_code: string; status: string }>(
      'select plan_code, status from subscriptions where organization_id = $1',
      [context.organizationId],
    );
    expect(subscription.rows).toEqual([{ plan_code: 'family', status: 'trialing' }]);
    await expect(
      service.create(context, uuidV7(), 'billing-trial-duplicate-subscription', '/v1/billing', {
        kind: 'billing',
        input: { planCode: 'self_service', status: 'trialing' },
      }),
    ).rejects.toThrow(/subscriptions_current_idx|duplicate key/u);
  });
});
