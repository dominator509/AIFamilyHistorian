import { describe, expect, it } from 'vitest';
import {
  assertScratchCapacity,
  REQUIRED_SCRATCH_RESERVE_BYTES,
} from '../../apps/worker/src/handlers.js';

describe('worker scratch capacity', () => {
  it('accepts input only when original and bounded derivative reserve fit', () => {
    expect(() =>
      assertScratchCapacity(1_000_000, 1_000_000 + REQUIRED_SCRATCH_RESERVE_BYTES),
    ).not.toThrow();
  });

  it('rejects oversized input before object download', () => {
    try {
      assertScratchCapacity(25 * 1024 * 1024 * 1024, 1 * 1024 * 1024 * 1024);
      throw new Error('expected capacity rejection');
    } catch (error) {
      expect(error).toMatchObject({ code: 'MEDIA_SCRATCH_INSUFFICIENT', retryable: false });
    }
  });

  it('fails closed on invalid capacity values', () => {
    expect(() => assertScratchCapacity(Number.NaN, 1)).toThrowError('media input size is invalid');
    expect(() => assertScratchCapacity(1, -1)).toThrowError('media scratch capacity is invalid');
  });
});
