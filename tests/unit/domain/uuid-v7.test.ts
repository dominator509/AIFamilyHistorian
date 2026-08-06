import { describe, expect, it } from 'vitest';
import { uuidV7 } from '../../../packages/database/src/index.js';

describe('UUIDv7 generator', () => {
  it('encodes the timestamp, version, variant, and random uniqueness', () => {
    const now = 1_786_049_600_000;
    const first = uuidV7(now);
    const second = uuidV7(now);
    expect(first).not.toBe(second);
    expect(first[14]).toBe('7');
    expect(['8', '9', 'a', 'b']).toContain(first[19]?.toLowerCase());
    expect(Number.parseInt(first.replaceAll('-', '').slice(0, 12), 16)).toBe(now);
  });
});
