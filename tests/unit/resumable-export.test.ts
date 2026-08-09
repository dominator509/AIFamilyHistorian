import { describe, expect, it } from 'vitest';
import {
  assertExportComplete,
  missingExportParts,
  planResumableExport,
} from '../../packages/storage/src/index.js';

const input = {
  exportId: '01900000-0000-7000-8000-000000000051',
  archiveId: '01900000-0000-7000-8000-000000000052',
  generatedAt: '2026-08-07T00:00:00.000Z',
};

describe('resumable export planning', () => {
  it('plans a 25 GB export without allocating the payload', () => {
    const manifest = planResumableExport({
      ...input,
      totalBytes: 25 * 1024 * 1024 * 1024,
      chunkSize: 64 * 1024 * 1024,
    });
    expect(manifest.chunks).toHaveLength(400);
    expect(manifest.chunks[0]).toMatchObject({
      partNumber: 1,
      offset: 0,
      byteSize: 64 * 1024 * 1024,
    });
    expect(manifest.chunks.at(-1)?.byteSize).toBe(64 * 1024 * 1024);
    expect(manifest.manifestSha256).toHaveLength(64);
    expect(missingExportParts(manifest, [1, 2, 400])).toHaveLength(397);
    expect(() =>
      assertExportComplete(
        manifest,
        manifest.chunks.map((chunk) => chunk.partNumber),
      ),
    ).not.toThrow();
  });

  it('fails closed on size and chunk limits', () => {
    expect(() =>
      planResumableExport({ ...input, totalBytes: 25 * 1024 * 1024 * 1024 + 1 }),
    ).toThrow('EXPORT_SIZE_INVALID');
    expect(() => planResumableExport({ ...input, totalBytes: 100, chunkSize: 1024 })).toThrow(
      'EXPORT_CHUNK_SIZE_INVALID',
    );
    const manifest = planResumableExport({ ...input, totalBytes: 5 * 1024 * 1024 });
    expect(() => assertExportComplete(manifest, [])).toThrow('EXPORT_INCOMPLETE');
    expect(() => planResumableExport({ ...input, generatedAt: 'not-a-timestamp' })).toThrow();
  });

  it('rejects duplicate and out-of-manifest completed parts', () => {
    const manifest = planResumableExport({ ...input, totalBytes: 5 * 1024 * 1024 });
    expect(() => missingExportParts(manifest, [1, 1])).toThrow('EXPORT_PART_DUPLICATE');
    expect(() => missingExportParts(manifest, [2])).toThrow('EXPORT_PART_INVALID');
  });
});
