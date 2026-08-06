import { describe, expect, it } from 'vitest';
import { healthStatusSchema } from '../../packages/contracts/src/index.js';

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
});
