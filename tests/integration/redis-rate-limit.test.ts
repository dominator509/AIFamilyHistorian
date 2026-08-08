import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Redis } from 'ioredis';
import { uuidV7 } from '../../packages/database/src/index.js';
import { RedisFixedWindowRateLimiter } from '../../packages/auth/src/rate-limit.js';
import { RedisSessionRevocationStore } from '../../packages/auth/src/session-revocation.js';

if (!process.env.REDIS_URL) process.loadEnvFile('.env');
const redis = new Redis(process.env.REDIS_URL!, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});

beforeAll(async () => {
  await redis.connect();
  await redis.ping();
});

afterAll(async () => {
  await redis.quit();
});

describe('Redis distributed rate limiter', () => {
  it('shares an atomic fixed window through the real Redis service', async () => {
    const limiter = new RedisFixedWindowRateLimiter(redis, {
      limit: 2,
      windowMilliseconds: 60_000,
      prefix: `integration:rate:${uuidV7()}`,
    });
    await expect(limiter.consume('integration-client')).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
    });
    await expect(limiter.consume('integration-client')).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });
    const blocked = await limiter.consume('integration-client');
    expect(blocked).toMatchObject({ allowed: false, remaining: 0 });
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('persists revocation in Redis without storing the raw session identifier', async () => {
    const store = new RedisSessionRevocationStore(redis, `integration:session:${uuidV7()}`);
    const sessionId = `integration-session-${uuidV7()}`;
    await expect(store.isRevoked(sessionId)).resolves.toBe(false);
    await store.revoke(sessionId, Math.floor(Date.now() / 1000) + 60);
    await expect(store.isRevoked(sessionId)).resolves.toBe(true);
  });
});
