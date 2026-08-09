import { describe, expect, it } from 'vitest';
import {
  assertCandidateEvidence,
  extractAnnotatedCandidates,
  MAX_ANNOTATED_CANDIDATES,
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

  it('rejects tampered spans and bounds annotation fan-out', () => {
    const text = '[PERSON: Ada]';
    const [candidate] = extractAnnotatedCandidates({
      text,
      sourceId: '01900000-0000-7000-8000-000000000001',
      revisionId: '01900000-0000-7000-8000-000000000002',
    });
    expect(() => assertCandidateEvidence({ ...candidate!, value: 'Grace' }, text)).toThrow(
      /does not match/u,
    );
    expect(() =>
      assertCandidateEvidence({ ...candidate!, startOffset: Number.MAX_SAFE_INTEGER + 1 }, text),
    ).toThrow(/offsets/u);
    expect(() =>
      assertCandidateEvidence({ ...candidate!, kind: 'invalid' as never }, text),
    ).toThrow(/kind/u);
    const many = Array.from({ length: MAX_ANNOTATED_CANDIDATES + 1 }, () => text).join(' ');
    expect(() =>
      extractAnnotatedCandidates({
        text: many,
        sourceId: '01900000-0000-7000-8000-000000000001',
        revisionId: '01900000-0000-7000-8000-000000000002',
      }),
    ).toThrow(/candidate count/u);
  });
});
