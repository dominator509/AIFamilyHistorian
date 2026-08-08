import { describe, expect, it } from 'vitest';
import { RedisSessionRevocationStore } from '../../packages/auth/src/session-revocation.js';

describe('Redis session revocation store', () => {
  it('hashes identifiers and expires revocations with the token', async () => {
    const calls: string[][] = [];
    const store = new RedisSessionRevocationStore({
      eval: (_script, _keys, ...args) => {
        calls.push(args);
        return Promise.resolve(calls.length === 1 ? 0 : 1);
      },
    });
    await expect(store.isRevoked('session-1')).resolves.toBe(false);
    await store.revoke('session-1', Math.floor(Date.now() / 1000) + 60);
    expect(calls[0]?.[0]).toMatch(/^family-historian:session-revoked:[a-f0-9]{64}$/u);
    expect(calls[0]?.[0]).not.toContain('session-1');
    expect(calls[1]?.[0]).toBe(calls[0]?.[0]);
  });

  it('does not persist already expired sessions', async () => {
    const calls: string[][] = [];
    const store = new RedisSessionRevocationStore({
      eval: (_script, _keys, ...args) => {
        calls.push(args);
        return Promise.resolve(1);
      },
    });
    await store.revoke('expired', Math.floor(Date.now() / 1000) - 1);
    expect(calls).toHaveLength(0);
  });
});
