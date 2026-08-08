import { createHash } from 'node:crypto';
import type { RedisScriptClient } from './rate-limit.js';

export interface SessionRevocationStore {
  isRevoked(sessionId: string): Promise<boolean>;
  revoke(sessionId: string, expiresAt: number): Promise<void>;
}

/**
 * Redis-backed deny-list for short-lived bearer sessions. Session identifiers
 * are hashed before persistence and entries expire with the token, so revoking
 * a token never creates unbounded durable state.
 */
export class RedisSessionRevocationStore implements SessionRevocationStore {
  public constructor(
    private readonly client: RedisScriptClient,
    private readonly prefix = 'family-historian:session-revoked',
  ) {
    if (!/^[A-Za-z0-9:_-]{1,64}$/u.test(prefix))
      throw new Error('session revocation prefix is invalid');
  }

  public async isRevoked(sessionId: string): Promise<boolean> {
    const result = await this.client.eval(
      "return redis.call('EXISTS', KEYS[1])",
      1,
      this.key(sessionId),
    );
    return Number(result) === 1;
  }

  public async revoke(sessionId: string, expiresAt: number): Promise<void> {
    const ttlMilliseconds = expiresAt * 1000 - Date.now();
    if (!Number.isSafeInteger(ttlMilliseconds) || ttlMilliseconds <= 0) return;
    await this.client.eval(
      "redis.call('SET', KEYS[1], '1', 'PX', ARGV[1]); return 1",
      1,
      this.key(sessionId),
      String(ttlMilliseconds),
    );
  }

  private key(sessionId: string): string {
    if (!sessionId.trim()) throw new Error('session identifier is required');
    const digest = createHash('sha256').update(sessionId, 'utf8').digest('hex');
    return `${this.prefix}:${digest}`;
  }
}
