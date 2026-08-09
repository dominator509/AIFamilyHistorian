import { describe, expect, it } from 'vitest';
import {
  completeUploadInputSchema,
  factInputSchema,
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

  it('bounds evidence-link fan-out before SQL persistence', () => {
    expect(() =>
      factInputSchema.parse({
        text: 'A fact',
        confirmerId: '01900000-0000-7000-8000-000000000001',
        evidenceLinkIds: Array.from(
          { length: 1_001 },
          () => '01900000-0000-7000-8000-000000000002',
        ),
      }),
    ).toThrow();
  });
});
