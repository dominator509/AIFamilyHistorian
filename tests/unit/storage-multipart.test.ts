import { describe, expect, it } from 'vitest';
import { MAX_MULTIPART_TOKEN_CHARS } from '../../packages/contracts/src/index.js';
import {
  MAX_OBJECT_KEY_CHARS,
  MAX_OBJECT_KEY_BYTES,
  MAX_PROVIDER_UPLOAD_ID_CHARS,
  MAX_PROVIDER_UPLOAD_ID_BYTES,
  MAX_STORAGE_CONTENT_TYPE_BYTES,
  ObjectStorageLimitError,
  validateProviderUploadId,
  validateSha256Base64,
  validateStorageContentType,
  validateObjectKey,
  validateCompletedUploadParts,
} from '../../packages/storage/src/service.js';

describe('multipart completion validation', () => {
  it('rejects malformed object keys before provider calls', () => {
    expect(() => validateObjectKey('')).toThrow('object storage key is invalid');
    expect(() => validateObjectKey(`x${'a'.repeat(MAX_OBJECT_KEY_CHARS)}`)).toThrow(
      'object storage key is invalid',
    );
    expect(() => validateObjectKey('é'.repeat(MAX_OBJECT_KEY_BYTES / 2 + 1))).toThrow(
      'object storage key is invalid',
    );
    expect(() => validateObjectKey('safe/\u0000-key')).toThrow('object storage key is invalid');
    expect(() => validateObjectKey('tenants/archive/originals/object-1')).not.toThrow();
  });

  it('rejects malformed provider upload metadata before provider calls', () => {
    expect(() => validateProviderUploadId('')).toThrow('object storage upload id is invalid');
    expect(() => validateProviderUploadId('x'.repeat(MAX_PROVIDER_UPLOAD_ID_CHARS + 1))).toThrow(
      'object storage upload id is invalid',
    );
    expect(() =>
      validateProviderUploadId('é'.repeat(MAX_PROVIDER_UPLOAD_ID_BYTES / 2 + 1)),
    ).toThrow('object storage upload id is invalid');
    expect(() => validateStorageContentType('not-a-mime')).toThrow(
      'object storage content type is invalid',
    );
    expect(() =>
      validateStorageContentType(`text/${'é'.repeat(MAX_STORAGE_CONTENT_TYPE_BYTES)}`),
    ).toThrow('object storage content type is invalid');
    expect(() => validateStorageContentType('application/octet-stream')).not.toThrow();
    expect(() => validateSha256Base64('not-a-checksum')).toThrow(
      'object storage SHA-256 checksum is invalid',
    );
    expect(() => validateSha256Base64('A'.repeat(43) + '=')).not.toThrow();
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
