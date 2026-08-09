import { describe, expect, it } from 'vitest';
import { MAX_MULTIPART_TOKEN_CHARS } from '../../packages/contracts/src/index.js';
import {
  MAX_OBJECT_KEY_CHARS,
  ObjectStorageLimitError,
  validateObjectKey,
  validateCompletedUploadParts,
} from '../../packages/storage/src/service.js';

describe('multipart completion validation', () => {
  it('rejects malformed object keys before provider calls', () => {
    expect(() => validateObjectKey('')).toThrow('object storage key is invalid');
    expect(() => validateObjectKey(`x${'a'.repeat(MAX_OBJECT_KEY_CHARS)}`)).toThrow(
      'object storage key is invalid',
    );
    expect(() => validateObjectKey('safe/\u0000-key')).toThrow('object storage key is invalid');
    expect(() => validateObjectKey('tenants/archive/originals/object-1')).not.toThrow();
  });

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
    expect(() =>
      validateCompletedUploadParts([
        { PartNumber: 1, ETag: 'etag', ChecksumSHA256: 'x'.repeat(MAX_MULTIPART_TOKEN_CHARS + 1) },
      ]),
    ).toThrow('invalid part');
  });

  it('caps completion cardinality', () => {
    const parts = Array.from({ length: 10_001 }, (_, index) => ({
      PartNumber: index + 1,
      ETag: `etag-${index + 1}`,
    }));
    expect(() => validateCompletedUploadParts(parts)).toThrow(ObjectStorageLimitError);
  });
});
