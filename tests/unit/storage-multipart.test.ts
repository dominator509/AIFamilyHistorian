import { describe, expect, it } from 'vitest';
import {
  ObjectStorageLimitError,
  validateCompletedUploadParts,
} from '../../packages/storage/src/service.js';

describe('multipart completion validation', () => {
  it('normalizes valid parts into provider order', () => {
    expect(
      validateCompletedUploadParts([
        { PartNumber: 2, ETag: 'etag-2' },
        { PartNumber: 1, ETag: 'etag-1', ChecksumSHA256: 'checksum-1' },
      ]),
    ).toEqual([
      { PartNumber: 1, ETag: 'etag-1', ChecksumSHA256: 'checksum-1' },
      { PartNumber: 2, ETag: 'etag-2' },
    ]);
  });

  it('rejects duplicate and malformed provider parts before network calls', () => {
    expect(() =>
      validateCompletedUploadParts([
        { PartNumber: 1, ETag: 'etag-1' },
        { PartNumber: 1, ETag: 'etag-duplicate' },
      ]),
    ).toThrow('duplicate part numbers');
    expect(() => validateCompletedUploadParts([{ PartNumber: 0, ETag: 'etag' }])).toThrow(
      'invalid part',
    );
    expect(() => validateCompletedUploadParts([{ PartNumber: 1, ETag: '   ' }])).toThrow(
      'invalid part',
    );
  });

  it('caps completion cardinality', () => {
    const parts = Array.from({ length: 10_001 }, (_, index) => ({
      PartNumber: index + 1,
      ETag: `etag-${index + 1}`,
    }));
    expect(() => validateCompletedUploadParts(parts)).toThrow(ObjectStorageLimitError);
  });
});
