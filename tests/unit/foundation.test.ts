import { describe, expect, it } from 'vitest';
import {
  completeUploadInputSchema,
  healthStatusSchema,
} from '../../packages/contracts/src/index.js';

describe('foundation contracts', () => {
  it('rejects an unknown health state', () => {
    expect(() =>
      healthStatusSchema.parse({
        service: 'api',
        status: 'unknown',
        timestamp: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it('rejects duplicate multipart parts before provider completion', () => {
    expect(() =>
      completeUploadInputSchema.parse({
        parts: [
          { ETag: 'etag-1', PartNumber: 1 },
          { ETag: 'etag-2', PartNumber: 1 },
        ],
      }),
    ).toThrow('multipart part numbers must be unique');
  });
});
