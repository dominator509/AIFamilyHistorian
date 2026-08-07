import type { EntityId } from '@family-historian/contracts';
import { uuidSchema } from '@family-historian/contracts';
import { randomUUID } from 'node:crypto';
import { DomainError } from './errors.js';

export type CandidateKind =
  | 'person'
  | 'place'
  | 'date'
  | 'event'
  | 'relationship'
  | 'quotation'
  | 'recipe'
  | 'artifact'
  | 'theme';

export interface CandidateEntity {
  readonly id: EntityId;
  readonly kind: CandidateKind;
  readonly value: string;
  readonly sourceId: EntityId;
  readonly revisionId: EntityId;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly status: 'candidate';
}

const markerPattern =
  /\[(PERSON|PLACE|DATE|EVENT|RELATIONSHIP|QUOTATION|RECIPE|ARTIFACT|THEME):\s*([^\]\r\n]+)\]/gu;

/**
 * Extract only explicit source annotations. Candidate records remain
 * unconfirmed and carry character offsets so a human can review the exact span.
 */
export function extractAnnotatedCandidates(input: {
  text: string;
  sourceId: EntityId;
  revisionId: EntityId;
}): readonly CandidateEntity[] {
  uuidSchema.parse(input.sourceId);
  uuidSchema.parse(input.revisionId);
  const candidates: CandidateEntity[] = [];
  for (const match of input.text.matchAll(markerPattern)) {
    const kind = match[1]?.toLowerCase() as CandidateKind | undefined;
    const value = match[2]?.trim();
    const startOffset = match.index;
    if (!kind || !value || startOffset === undefined) continue;
    const endOffset = startOffset + match[0].length;
    candidates.push({
      id: randomUUID(),
      kind,
      value,
      sourceId: input.sourceId,
      revisionId: input.revisionId,
      startOffset,
      endOffset,
      status: 'candidate',
    });
  }
  return Object.freeze(candidates.map((candidate) => Object.freeze(candidate)));
}

export function assertCandidateEvidence(candidate: CandidateEntity, sourceText: string): void {
  if (sourceText.slice(candidate.startOffset, candidate.endOffset).length === 0)
    throw new DomainError('EVIDENCE_MISSING', 'candidate source span is unavailable');
  if (candidate.status !== 'candidate')
    throw new DomainError('VALIDATION_FAILED', 'candidate status is invalid');
}
