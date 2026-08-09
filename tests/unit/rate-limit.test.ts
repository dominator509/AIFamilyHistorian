import { describe, expect, it } from 'vitest';
import {
  FixedWindowRateLimiter,
  MAX_RATE_LIMIT_COUNT,
  MAX_RATE_LIMIT_KEYS,
  MAX_RATE_LIMIT_WINDOW_MILLISECONDS,
  RedisFixedWindowRateLimiter,
} from '../../packages/auth/src/rate-limit.js';

describe('FixedWindowRateLimiter', () => {
  it('enforces a bounded fixed window and reports retry metadata', () => {
    const limiter = new FixedWindowRateLimiter({ limit: 2, windowMilliseconds: 10_000 });

    expect(limiter.consume('client-a', 1_000)).toMatchObject({
      allowed: true,
      limit: 2,
      remaining: 1,
      retryAfterSeconds: 0,
    });
    expect(limiter.consume('client-a', 2_000)).toMatchObject({
      allowed: true,
      limit: 2,
      remaining: 0,
      retryAfterSeconds: 0,
    });
    expect(limiter.consume('client-a', 3_000)).toMatchObject({
      allowed: false,
      limit: 2,
      remaining: 0,
      retryAfterSeconds: 8,
    });
    expect(limiter.consume('client-a', 11_000)).toMatchObject({
      allowed: true,
      remaining: 1,
      retryAfterSeconds: 0,
    });
  });

  it('evicts expired and oldest keys to stay bounded', () => {
    const limiter = new FixedWindowRateLimiter({
      limit: 1,
      windowMilliseconds: 1_000,
      maxKeys: 2,
    });

    limiter.consume('first', 0);
    limiter.consume('second', 0);
    limiter.consume('third', 0);
    expect(limiter.consume('third', 0).allowed).toBe(false);
    expect(limiter.consume('first', 1_001).allowed).toBe(true);
  });

  it('rejects invalid configuration and keys', () => {
    expect(() => new FixedWindowRateLimiter({ limit: 0, windowMilliseconds: 1 })).toThrow(
      'rate limiter configuration is invalid',
    );
    expect(
      () => new FixedWindowRateLimiter({ limit: MAX_RATE_LIMIT_COUNT + 1, windowMilliseconds: 1 }),
    ).toThrow('rate limiter configuration is invalid');
    expect(
      () =>
        new FixedWindowRateLimiter({
          limit: 1,
          windowMilliseconds: MAX_RATE_LIMIT_WINDOW_MILLISECONDS + 1,
        }),
    ).toThrow('rate limiter configuration is invalid');
    expect(
      () => new FixedWindowRateLimiter({ limit: 1, windowMilliseconds: 1, maxKeys: 0 }),
    ).toThrow('rate limiter configuration is invalid');
    expect(
      () =>
        new FixedWindowRateLimiter({
          limit: 1,
          windowMilliseconds: 1,
          maxKeys: MAX_RATE_LIMIT_KEYS + 1,
        }),
    ).toThrow('rate limiter configuration is invalid');
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowMilliseconds: 1 });
    expect(() => limiter.consume('  ', 0)).toThrow('rate limiter key is required');
    expect(() => limiter.consume('client-a', Number.NaN)).toThrow(
      'rate limiter timestamp is invalid',
    );
    expect(() => limiter.consume('client-a', -1)).toThrow('rate limiter timestamp is invalid');
  });

  it('uses an atomic Redis result and never sends the raw key to Redis', async () => {
    const calls: string[][] = [];
    const limiter = new RedisFixedWindowRateLimiter(
      {
        eval: (_script, _numberOfKeys, ...args) => {
          calls.push(args);
          return Promise.resolve([3, 4_001]);
        },
      },
      { limit: 2, windowMilliseconds: 10_000, prefix: 'test:limit' },
    );
    await expect(limiter.consume('203.0.113.10')).resolves.toEqual({
      allowed: false,
      limit: 2,
      remaining: 0,
      retryAfterSeconds: 5,
    });
    expect(calls[0]?.[0]).toMatch(/^test:limit:[a-f0-9]{64}$/u);
    expect(calls[0]?.[0]).not.toContain('203.0.113.10');
    expect(
      () =>
        new RedisFixedWindowRateLimiter(
          { eval: () => Promise.resolve([1, 1]) },
          { limit: MAX_RATE_LIMIT_COUNT + 1, windowMilliseconds: 1 },
        ),
    ).toThrow('rate limiter configuration is invalid');
  });
});
