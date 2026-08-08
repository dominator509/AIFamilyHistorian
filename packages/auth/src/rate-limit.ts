import { createHash } from 'node:crypto';

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, nowMilliseconds?: number): RateLimitDecision | Promise<RateLimitDecision>;
}

export interface RedisScriptClient {
  eval(script: string, numberOfKeys: number, ...arguments_: string[]): Promise<unknown>;
}

interface WindowBucket {
  startedAt: number;
  count: number;
}

export class FixedWindowRateLimiter implements RateLimiter {
  readonly #buckets = new Map<string, WindowBucket>();
  public constructor(
    private readonly options: {
      readonly limit: number;
      readonly windowMilliseconds: number;
      readonly maxKeys?: number;
    },
  ) {
    if (
      !Number.isInteger(options.limit) ||
      options.limit < 1 ||
      !Number.isInteger(options.windowMilliseconds) ||
      options.windowMilliseconds < 1
    )
      throw new Error('rate limiter configuration is invalid');
  }

  public consume(key: string, nowMilliseconds = Date.now()): RateLimitDecision {
    if (!key.trim()) throw new Error('rate limiter key is required');
    const existing = this.#buckets.get(key);
    const expired =
      existing === undefined ||
      nowMilliseconds - existing.startedAt >= this.options.windowMilliseconds;
    const bucket = expired ? { startedAt: nowMilliseconds, count: 0 } : existing;
    bucket.count += 1;
    this.#buckets.set(key, bucket);
    this.evictIfNeeded(nowMilliseconds);
    const allowed = bucket.count <= this.options.limit;
    const remaining = Math.max(0, this.options.limit - bucket.count);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.startedAt + this.options.windowMilliseconds - nowMilliseconds) / 1000),
    );
    return Object.freeze({
      allowed,
      limit: this.options.limit,
      remaining,
      retryAfterSeconds: allowed ? 0 : retryAfterSeconds,
    });
  }

  private evictIfNeeded(nowMilliseconds: number): void {
    const maxKeys = this.options.maxKeys ?? 10_000;
    if (this.#buckets.size <= maxKeys) return;
    for (const [key, bucket] of this.#buckets) {
      if (nowMilliseconds - bucket.startedAt >= this.options.windowMilliseconds)
        this.#buckets.delete(key);
      if (this.#buckets.size <= maxKeys) return;
    }
    const oldest = this.#buckets.keys().next().value;
    if (oldest !== undefined) this.#buckets.delete(oldest);
  }
}

const REDIS_FIXED_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`;

/**
 * Atomic, horizontally shared fixed-window limiter. The caller-provided key is
 * hashed before it reaches Redis so raw addresses or identifiers never become
 * durable key material in the cache.
 */
export class RedisFixedWindowRateLimiter implements RateLimiter {
  public constructor(
    private readonly client: RedisScriptClient,
    private readonly options: {
      readonly limit: number;
      readonly windowMilliseconds: number;
      readonly prefix?: string;
    },
  ) {
    if (
      !Number.isInteger(options.limit) ||
      options.limit < 1 ||
      !Number.isInteger(options.windowMilliseconds) ||
      options.windowMilliseconds < 1
    )
      throw new Error('rate limiter configuration is invalid');
    if (options.prefix !== undefined && !/^[A-Za-z0-9:_-]{1,64}$/u.test(options.prefix))
      throw new Error('rate limiter prefix is invalid');
  }

  public async consume(key: string): Promise<RateLimitDecision> {
    if (!key.trim()) throw new Error('rate limiter key is required');
    const digest = createHash('sha256').update(key, 'utf8').digest('hex');
    const redisKey = `${this.options.prefix ?? 'family-historian:ratelimit'}:${digest}`;
    const result = await this.client.eval(
      REDIS_FIXED_WINDOW_SCRIPT,
      1,
      redisKey,
      String(this.options.windowMilliseconds),
    );
    if (!Array.isArray(result) || result.length < 2)
      throw new Error('rate limiter returned an invalid Redis result');
    const count = Number(result[0]);
    const ttlMilliseconds = Number(result[1]);
    if (!Number.isSafeInteger(count) || !Number.isFinite(ttlMilliseconds) || ttlMilliseconds < 0)
      throw new Error('rate limiter returned invalid counters');
    const allowed = count <= this.options.limit;
    return Object.freeze({
      allowed,
      limit: this.options.limit,
      remaining: Math.max(0, this.options.limit - count),
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil(ttlMilliseconds / 1000)),
    });
  }
}
