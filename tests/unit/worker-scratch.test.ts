import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertScratchCapacity,
  readBoundedFile,
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

  it('bounds derivative materialization even when the file exceeds the checked ceiling', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'worker-bounded-read-'));
    const path = join(directory, 'derivative.bin');
    try {
      await writeFile(path, Buffer.from('0123456789', 'utf8'));
      await expect(readBoundedFile(path, 10)).resolves.toEqual(Buffer.from('0123456789'));
      await expect(readBoundedFile(path, 9)).rejects.toMatchObject({
        code: 'MEDIA_OUTPUT_TOO_LARGE',
        retryable: false,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
