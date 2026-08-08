import { describe, expect, it } from 'vitest';
import { FixedWindowRateLimiter } from '../../packages/auth/src/rate-limit.js';

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
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowMilliseconds: 1 });
    expect(() => limiter.consume('  ', 0)).toThrow('rate limiter key is required');
  });
});
