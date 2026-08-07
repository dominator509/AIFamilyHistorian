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

if (!process.env.DATABASE_URL) process.loadEnvFile('.env');
const sessionSecret = process.env.SESSION_SECRET ?? '';
const encryptionKey = process.env.FIELD_ENCRYPTION_MASTER_KEY ?? '';
const pool = createPool();
const context = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
const userId = uuidV7();
const service = new ArchiveService(pool, encryptionKey);
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
});
afterAll(async () => {
  await app.close();
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
});
