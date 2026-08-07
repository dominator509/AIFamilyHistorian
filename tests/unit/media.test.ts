import { describe, expect, it } from 'vitest';
import {
  assertOriginalImmutable,
  buildMediaPipelinePlan,
  MediaPipelineError,
  transitionQuarantine,
  validateMediaDescriptor,
} from '../../packages/media/src/index.js';

const descriptor = {
  id: '01900000-0000-7000-8000-000000000021',
  objectKey: 'org/archive/originals/asset-1',
  contentType: 'audio/wav',
  byteSize: 1024,
  sha256Hex: 'a'.repeat(64),
  kind: 'audio' as const,
};

describe('media pipeline boundaries', () => {
  it('builds a bounded argv plan without shell interpolation', () => {
    const plan = buildMediaPipelinePlan(descriptor);
    expect(plan.map((step) => step.name)).toEqual([
      'malware-scan',
      'metadata-probe',
      'waveform-derivative',
    ]);
    for (const step of plan) {
      expect(step.args.join(' ')).not.toMatch(/[;&|`$]/u);
      expect(step.timeoutSeconds).toBeGreaterThan(0);
    }
  });

  it('fails closed for invalid quarantine transitions and original mutation', () => {
    expect(transitionQuarantine('pending', 'scanning')).toBe('scanning');
    expect(transitionQuarantine('scanning', 'infected')).toBe('infected');
    expect(() => transitionQuarantine('clean', 'scanning')).toThrow(MediaPipelineError);
    expect(() =>
      assertOriginalImmutable(descriptor, { ...descriptor, sha256Hex: 'b'.repeat(64) }),
    ).toThrow('fixity is immutable');
  });

  it('rejects traversal and mismatched media kinds', () => {
    expect(() => validateMediaDescriptor({ ...descriptor, objectKey: '../escape' })).toThrow();
    expect(() => validateMediaDescriptor({ ...descriptor, kind: 'video' })).toThrow(
      'media kind does not match',
    );
  });
});
