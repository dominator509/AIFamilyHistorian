import { describe, expect, it } from 'vitest';
import {
  eventInputSchema,
  mediaInputSchema,
  personInputSchema,
} from '../../packages/contracts/src/api.js';

describe('authoring visibility contracts', () => {
  it('rejects public_approved until the publication workflow creates approval evidence', () => {
    expect(() =>
      personInputSchema.parse({
        displayName: 'Ada',
        isLiving: false,
        visibility: 'public_approved',
      }),
    ).toThrow();
    expect(() =>
      mediaInputSchema.parse({ mediaType: 'image', visibility: 'public_approved' }),
    ).toThrow();
    expect(() =>
      eventInputSchema.parse({
        eventType: 'birth',
        datePrecision: 'year',
        visibility: 'public_approved',
      }),
    ).toThrow();
  });
});
