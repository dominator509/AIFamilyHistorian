export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, nowMilliseconds?: number): RateLimitDecision;
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
