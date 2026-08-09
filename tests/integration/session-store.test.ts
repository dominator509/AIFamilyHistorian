import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresSessionStore } from '../../apps/api/src/session-store.js';
import {
  bootstrapArchive,
  createPool,
  migrate,
  uuidV7,
  type DatabaseContext,
} from '../../packages/database/src/index.js';
import type { SessionPrincipal } from '../../packages/auth/src/index.js';

if (!process.env.DATABASE_URL) process.loadEnvFile('.env');
const pool = createPool();
const store = new PostgresSessionStore(pool);

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

function principal(context: DatabaseContext): SessionPrincipal {
  return {
    sessionId: uuidV7(),
    userId: uuidV7(),
    organizationId: context.organizationId,
    archiveIds: [context.familyArchiveId],
    permissions: ['people:read'],
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };
}

describe('PostgreSQL server-side sessions', () => {
  it('registers an inventory row while hashing device metadata', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Session family', 'Session archive');
    const value = principal(context);
    const stored = await store.ensure(value, {
      deviceLabel: 'family laptop',
      userAgent: 'browser-secret-user-agent',
      ipAddress: '203.0.113.10',
    });
    expect(stored).toMatchObject({
      sessionId: value.sessionId,
      userId: value.userId,
      deviceLabel: 'family laptop',
      revokedAt: null,
    });
    const row = await pool.query<{ user_agent_hash: string; ip_hash: string }>(
      'select user_agent_hash, ip_hash from auth_sessions where session_id = $1',
      [value.sessionId],
    );
    expect(row.rows[0]?.user_agent_hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(row.rows[0]?.ip_hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(row.rows[0]?.user_agent_hash).not.toContain('browser-secret');
  });

  it('rotates only the same principal and revokes the predecessor atomically', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Rotation family', 'Rotation archive');
    const current = principal(context);
    const replacement = { ...current, sessionId: uuidV7() };
    await store.ensure(current);
    await store.rotate(current.sessionId!, replacement);
    const revoked = await store.find(current.sessionId);
    expect(revoked?.sessionId).toBe(current.sessionId);
    expect(typeof revoked?.revokedAt).toBe('string');
    await expect(store.ensure(replacement)).resolves.toMatchObject({
      sessionId: replacement.sessionId,
      revokedAt: null,
    });
    await expect(
      store.rotate(current.sessionId, { ...current, sessionId: uuidV7() }),
    ).rejects.toThrow('AUTH_REQUIRED');
    await expect(
      store.rotate(replacement.sessionId, {
        ...replacement,
        sessionId: uuidV7(),
        userId: uuidV7(),
      }),
    ).rejects.toThrow('AUTH_REQUIRED');
  });

  it('supports user-scoped inventory and administrative revocation', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Inventory family', 'Inventory archive');
    const foreignContext: DatabaseContext = {
      organizationId: uuidV7(),
      familyArchiveId: uuidV7(),
    };
    await bootstrapArchive(pool, foreignContext, 'Foreign inventory family', 'Foreign archive');
    const first = principal(context);
    const second = { ...first, sessionId: uuidV7() };
    const foreign = {
      ...first,
      sessionId: uuidV7(),
      organizationId: foreignContext.organizationId,
      archiveIds: [foreignContext.familyArchiveId],
    };
    await store.ensure(first);
    await store.ensure(second);
    await store.ensure(foreign);
    await expect(store.listForUser(first.userId, context.organizationId)).resolves.toHaveLength(2);
    await expect(
      store.listForUser(first.userId, foreignContext.organizationId),
    ).resolves.toHaveLength(1);
    await store.revoke(foreign.sessionId, 'wrong-organization', context.organizationId);
    await expect(store.find(foreign.sessionId)).resolves.toMatchObject({ revokedAt: null });
    await expect(
      store.revokeAllForUser(first.userId, first.sessionId, context.organizationId),
    ).resolves.toBe(1);
    const revoked = await store.find(second.sessionId);
    expect(typeof revoked?.revokedAt).toBe('string');
    await expect(store.find(first.sessionId)).resolves.toMatchObject({ revokedAt: null });
    await expect(store.find(foreign.sessionId)).resolves.toMatchObject({ revokedAt: null });
  });
});
