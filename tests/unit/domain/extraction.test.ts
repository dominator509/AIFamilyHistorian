import { describe, expect, it } from 'vitest';
import {
  assertCandidateEvidence,
  extractAnnotatedCandidates,
} from '../../../packages/domain/src/index.js';

describe('deterministic candidate extraction', () => {
  it('preserves explicit source markers and offsets without auto-confirming them', () => {
    const text = 'A [PERSON: Ada] visited [PLACE: Halifax].';
    const candidates = extractAnnotatedCandidates({
      text,
      sourceId: '01900000-0000-7000-8000-000000000001',
      revisionId: '01900000-0000-7000-8000-000000000002',
    });
    expect(candidates.map((candidate) => [candidate.kind, candidate.value])).toEqual([
      ['person', 'Ada'],
      ['place', 'Halifax'],
    ]);
    expect(candidates[0]?.status).toBe('candidate');
    expect(text.slice(candidates[0]!.startOffset, candidates[0]!.endOffset)).toBe('[PERSON: Ada]');
    expect(() => assertCandidateEvidence(candidates[0]!, text)).not.toThrow();
  });
});
