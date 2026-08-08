import { describe, expect, it } from 'vitest';
import { createApp } from '../../apps/api/src/app.js';
import { issueSessionToken } from '../../apps/api/src/session.js';
import type { RateLimiter } from '../../packages/auth/src/rate-limit.js';

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
});
