import { describe, expect, it } from 'vitest';
import { createApp } from '../../apps/api/src/app.js';
import { issueSessionToken } from '../../apps/api/src/session.js';
import type { RateLimiter } from '../../packages/auth/src/rate-limit.js';
import type { SessionRevocationStore } from '../../packages/auth/src/session-revocation.js';
import type {
  SessionPrincipal,
  SessionStore,
  StoredSession,
} from '../../packages/auth/src/session-store.js';

describe('API principal and archive rate scopes', () => {
  it('supports explicit server-side registration, rotation, inventory, and self-revocation', async () => {
    const records = new Map<string, StoredSession>();
    const sessionStore: SessionStore = {
      ensure: (value) => {
        const now = new Date().toISOString();
        const stored: StoredSession = {
          ...value,
          sessionId: value.sessionId!,
          createdAt: records.get(value.sessionId!)?.createdAt ?? now,
          lastSeenAt: now,
          revokedAt: records.get(value.sessionId!)?.revokedAt ?? null,
          deviceLabel: 'test device',
        };
        records.set(value.sessionId!, stored);
        return Promise.resolve(stored);
      },
      rotate: (currentSessionId) => {
        const current = records.get(currentSessionId);
        if (!current) return Promise.reject(new Error('AUTH_REQUIRED'));
        records.set(currentSessionId, { ...current, revokedAt: new Date().toISOString() });
        return Promise.resolve();
      },
      revoke: (sessionId) => {
        const current = records.get(sessionId);
        if (current) records.set(sessionId, { ...current, revokedAt: new Date().toISOString() });
        return Promise.resolve();
      },
      revokeAllForUser: (userId, exceptSessionId) => {
        let count = 0;
        for (const [sessionId, current] of records) {
          if (current.userId === userId && sessionId !== exceptSessionId && !current.revokedAt) {
            records.set(sessionId, { ...current, revokedAt: new Date().toISOString() });
            count += 1;
          }
        }
        return Promise.resolve(count);
      },
      listForUser: (userId) =>
        Promise.resolve([...records.values()].filter((item) => item.userId === userId)),
      find: (sessionId) => Promise.resolve(records.get(sessionId) ?? null),
    };
    const sessionSecret = 'inventory'.repeat(4);
    const principal: Omit<SessionPrincipal, 'sessionId'> = {
      userId: '01900000-0000-7000-8000-000000000091',
      organizationId: '01900000-0000-7000-8000-000000000092',
      archiveIds: ['01900000-0000-7000-8000-000000000093'],
      permissions: ['people:read'],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = issueSessionToken(sessionSecret, principal);
    const app = await createApp({
      service: { ready: () => Promise.resolve(true), list: () => Promise.resolve([]) } as never,
      sessionSecret,
      sessionStore,
      rateLimiter: {
        consume: () => ({ allowed: true, limit: 120, remaining: 119, retryAfterSeconds: 0 }),
      },
    });
    try {
      const headers = { authorization: `Bearer ${token}` };
      expect(
        (await app.inject({ method: 'POST', url: '/v1/session/register', headers })).statusCode,
      ).toBe(204);
      const inventory = await app.inject({ method: 'GET', url: '/v1/session', headers });
      expect(inventory.statusCode).toBe(200);
      expect(inventory.body).toMatch(/"items":\s*\[/u);
      const rotated = await app.inject({ method: 'POST', url: '/v1/session/rotate', headers });
      expect(rotated.statusCode).toBe(200);
      expect(rotated.body).toMatch(/"token":"v1\./u);
      const oldSessionId = [...records.keys()][0]!;
      expect(records.get(oldSessionId)?.revokedAt).toEqual(expect.any(String));
      const rotatedToken = /"token":"([^"]+)"/u.exec(rotated.body)?.[1];
      expect(rotatedToken).toBeTypeOf('string');
      if (!rotatedToken) throw new Error('rotation token missing');
      const logout = await app.inject({
        method: 'POST',
        url: '/v1/session/logout',
        headers: { authorization: `Bearer ${rotatedToken}` },
      });
      expect(logout.statusCode).toBe(204);
    } finally {
      await app.close();
    }
  });

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
      sessionMembershipChecker: () => Promise.resolve(true),
      sessionPermissionChecker: () => Promise.resolve(true),
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

  it('fails closed when archive authorization checkers are not configured', async () => {
    const archiveId = '01900000-0000-7000-8000-000000000034';
    const secret = 'missing-checker'.repeat(3);
    const token = issueSessionToken(secret, {
      userId: '01900000-0000-7000-8000-000000000035',
      organizationId: '01900000-0000-7000-8000-000000000036',
      archiveIds: [archiveId],
      permissions: ['people:read'],
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    const app = await createApp({
      service: { ready: () => Promise.resolve(true), list: () => Promise.resolve([]) } as never,
      sessionSecret: secret,
      rateLimiter: {
        consume: () => ({ allowed: true, limit: 120, remaining: 119, retryAfterSeconds: 0 }),
      },
    });
    try {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/archives/${archiveId}/people`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ code: 'PROVIDER_UNAVAILABLE', retryable: true });
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

  it('rejects a bearer token whose archive membership was revoked', async () => {
    const token = issueSessionToken('m'.repeat(32), {
      userId: '01900000-0000-7000-8000-000000000071',
      organizationId: '01900000-0000-7000-8000-000000000072',
      archiveIds: ['01900000-0000-7000-8000-000000000073'],
      permissions: ['archive:*'],
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    const app = await createApp({
      service: { ready: () => Promise.resolve(true), list: () => Promise.resolve([]) } as never,
      sessionSecret: 'm'.repeat(32),
      rateLimiter: {
        consume: () => ({ allowed: true, limit: 120, remaining: 119, retryAfterSeconds: 0 }),
      },
      sessionMembershipChecker: () => Promise.resolve(false),
      sessionPermissionChecker: () => Promise.resolve(true),
    });
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/archives/01900000-0000-7000-8000-000000000073/people',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ code: 'AUTH_REQUIRED' });
    } finally {
      await app.close();
    }
  });

  it('rejects stale membership on archive-scoped privacy and billing routes', async () => {
    const organizationId = '01900000-0000-7000-8000-000000000081';
    const archiveId = '01900000-0000-7000-8000-000000000082';
    const token = issueSessionToken('p'.repeat(32), {
      userId: '01900000-0000-7000-8000-000000000083',
      organizationId,
      archiveIds: [archiveId],
      permissions: ['privacy:write', 'billing:write'],
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    const app = await createApp({
      service: {
        ready: () => Promise.resolve(true),
        create: () =>
          Promise.resolve({
            response: { id: archiveId, status: 'accepted' },
            replayed: false,
          }),
      } as never,
      sessionSecret: 'p'.repeat(32),
      rateLimiter: {
        consume: () => ({ allowed: true, limit: 120, remaining: 119, retryAfterSeconds: 0 }),
      },
      sessionMembershipChecker: () => Promise.resolve(false),
      sessionPermissionChecker: () => Promise.resolve(true),
    });
    try {
      const headers = {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'stale-membership-privacy-billing',
      };
      const privacy = await app.inject({
        method: 'POST',
        url: '/v1/privacy-requests',
        headers,
        payload: { archiveId, requestType: 'access', requesterReference: 'subject-ref' },
      });
      expect(privacy.statusCode).toBe(401);
      const billing = await app.inject({
        method: 'POST',
        url: '/v1/billing',
        headers,
        payload: { planCode: 'family', status: 'trialing' },
      });
      expect(billing.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('rejects a stale archive permission claim before route execution', async () => {
    const archiveId = '01900000-0000-7000-8000-000000000092';
    const token = issueSessionToken('q'.repeat(32), {
      userId: '01900000-0000-7000-8000-000000000093',
      organizationId: '01900000-0000-7000-8000-000000000094',
      archiveIds: [archiveId],
      permissions: ['people:read'],
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    let listed = false;
    const app = await createApp({
      service: {
        ready: () => Promise.resolve(true),
        list: () => {
          listed = true;
          return Promise.resolve([]);
        },
      } as never,
      sessionSecret: 'q'.repeat(32),
      rateLimiter: {
        consume: () => ({ allowed: true, limit: 120, remaining: 119, retryAfterSeconds: 0 }),
      },
      sessionPermissionChecker: () => Promise.resolve(false),
    });
    try {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/archives/${archiveId}/people`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'PERMISSION_DENIED' });
      expect(listed).toBe(false);
    } finally {
      await app.close();
    }
  });

  it('fails closed as retryable when the live permission checker is unavailable', async () => {
    const archiveId = '01900000-0000-7000-8000-000000000095';
    const token = issueSessionToken('u'.repeat(32), {
      userId: '01900000-0000-7000-8000-000000000096',
      organizationId: '01900000-0000-7000-8000-000000000097',
      archiveIds: [archiveId],
      permissions: ['people:read'],
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    const app = await createApp({
      service: {
        ready: () => Promise.resolve(true),
        list: () => Promise.resolve([]),
      } as never,
      sessionSecret: 'u'.repeat(32),
      rateLimiter: {
        consume: () => ({ allowed: true, limit: 120, remaining: 119, retryAfterSeconds: 0 }),
      },
      sessionPermissionChecker: () => Promise.reject(new Error('database unavailable')),
    });
    try {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/archives/${archiveId}/people`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        code: 'PROVIDER_UNAVAILABLE',
        retryable: true,
      });
    } finally {
      await app.close();
    }
  });

  it('fails closed when a resource route has no current membership checker', async () => {
    const archiveId = '01900000-0000-7000-8000-000000000101';
    const token = issueSessionToken('w'.repeat(32), {
      userId: '01900000-0000-7000-8000-000000000102',
      organizationId: '01900000-0000-7000-8000-000000000103',
      archiveIds: [archiveId],
      permissions: ['people:read'],
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    let listed = false;
    const app = await createApp({
      service: {
        ready: () => Promise.resolve(true),
        list: () => {
          listed = true;
          return Promise.resolve([]);
        },
      } as never,
      sessionSecret: 'w'.repeat(32),
      rateLimiter: {
        consume: () => ({ allowed: true, limit: 120, remaining: 119, retryAfterSeconds: 0 }),
      },
      sessionPermissionChecker: () => Promise.resolve(true),
    });
    try {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/archives/${archiveId}/people`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        code: 'PROVIDER_UNAVAILABLE',
        retryable: true,
      });
      expect(listed).toBe(false);
    } finally {
      await app.close();
    }
  });

  it('fails closed as retryable when request-time membership lookup is unavailable', async () => {
    const archiveId = '01900000-0000-7000-8000-000000000098';
    const token = issueSessionToken('v'.repeat(32), {
      userId: '01900000-0000-7000-8000-000000000099',
      organizationId: '01900000-0000-7000-8000-000000000100',
      archiveIds: [archiveId],
      permissions: ['people:read'],
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    const app = await createApp({
      service: {
        ready: () => Promise.resolve(true),
        list: () => Promise.resolve([]),
      } as never,
      sessionSecret: 'v'.repeat(32),
      rateLimiter: {
        consume: () => ({ allowed: true, limit: 120, remaining: 119, retryAfterSeconds: 0 }),
      },
      sessionMembershipChecker: () => Promise.reject(new Error('database unavailable')),
    });
    try {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/archives/${archiveId}/people`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        code: 'PROVIDER_UNAVAILABLE',
        retryable: true,
      });
    } finally {
      await app.close();
    }
  });
});
