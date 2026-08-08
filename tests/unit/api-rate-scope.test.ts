import { describe, expect, it } from 'vitest';
import { createApp } from '../../apps/api/src/app.js';
import { issueSessionToken } from '../../apps/api/src/session.js';
import type { RateLimiter } from '../../packages/auth/src/rate-limit.js';
import type { SessionRevocationStore } from '../../packages/auth/src/session-revocation.js';

describe('API principal and archive rate scopes', () => {
  it('consumes authenticated principal and archive keys in addition to source IP', async () => {
    const keys: string[] = [];
    const rateLimiter: RateLimiter = {
      consume: (key) => {
        keys.push(key);
        return { allowed: true, limit: 120, remaining: 119, retryAfterSeconds: 0 };
      },
    };
    const organizationId = '01900000-0000-7000-8000-000000000031';
    const archiveId = '01900000-0000-7000-8000-000000000032';
    const token = issueSessionToken('s'.repeat(32), {
      userId: '01900000-0000-7000-8000-000000000033',
      organizationId,
      archiveIds: [archiveId],
      permissions: ['people:read'],
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    const app = await createApp({
      service: {
        ready: () => Promise.resolve(true),
        list: () => Promise.resolve([]),
      } as never,
      sessionSecret: 's'.repeat(32),
      rateLimiter,
    });
    try {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/archives/${archiveId}/people`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(200);
      expect(keys).toEqual([
        '127.0.0.1',
        `principal:${organizationId}:01900000-0000-7000-8000-000000000033`,
        `archive:${organizationId}:${archiveId}`,
      ]);
    } finally {
      await app.close();
    }
  });

  it('rejects a token present in the revocation store before route execution', async () => {
    const rateLimiter: RateLimiter = {
      consume: () => ({ allowed: true, limit: 120, remaining: 119, retryAfterSeconds: 0 }),
    };
    const sessionRevocationStore: SessionRevocationStore = {
      isRevoked: () => Promise.resolve(true),
      revoke: () => Promise.resolve(),
    };
    const archiveId = '01900000-0000-7000-8000-000000000042';
    const token = issueSessionToken('r'.repeat(32), {
      userId: '01900000-0000-7000-8000-000000000043',
      organizationId: '01900000-0000-7000-8000-000000000044',
      archiveIds: [archiveId],
      permissions: ['people:read'],
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    const app = await createApp({
      service: { ready: () => Promise.resolve(true), list: () => Promise.resolve([]) } as never,
      sessionSecret: 'r'.repeat(32),
      rateLimiter,
      sessionRevocationStore,
    });
    try {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/archives/${archiveId}/people`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ code: 'AUTH_REQUIRED' });
    } finally {
      await app.close();
    }
  });

  it('revokes the current bearer session through the logout endpoint', async () => {
    const revoked = new Set<string>();
    const sessionRevocationStore: SessionRevocationStore = {
      isRevoked: (sessionId) => Promise.resolve(revoked.has(sessionId)),
      revoke: (sessionId) => {
        revoked.add(sessionId);
        return Promise.resolve();
      },
    };
    const token = issueSessionToken('l'.repeat(32), {
      userId: '01900000-0000-7000-8000-000000000051',
      organizationId: '01900000-0000-7000-8000-000000000052',
      archiveIds: ['01900000-0000-7000-8000-000000000053'],
      permissions: ['archive:*'],
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    const app = await createApp({
      service: { ready: () => Promise.resolve(true), list: () => Promise.resolve([]) } as never,
      sessionSecret: 'l'.repeat(32),
      rateLimiter: {
        consume: () => ({ allowed: true, limit: 120, remaining: 119, retryAfterSeconds: 0 }),
      },
      sessionRevocationStore,
    });
    try {
      const logout = await app.inject({
        method: 'POST',
        url: '/v1/session/logout',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(logout.statusCode).toBe(204);
      expect(revoked.size).toBe(1);
      const after = await app.inject({
        method: 'GET',
        url: '/v1/archives',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(after.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
