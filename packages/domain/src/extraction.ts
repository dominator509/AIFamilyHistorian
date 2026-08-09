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

export const MAX_ANNOTATED_CANDIDATES = 1_000;
const candidateKinds: ReadonlySet<CandidateKind> = new Set([
  'person',
  'place',
  'date',
  'event',
  'relationship',
  'quotation',
  'recipe',
  'artifact',
  'theme',
]);

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
    if (candidates.length >= MAX_ANNOTATED_CANDIDATES)
      throw new DomainError('VALIDATION_FAILED', 'annotated candidate count exceeds the limit');
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
  if (candidate.status !== 'candidate')
    throw new DomainError('VALIDATION_FAILED', 'candidate status is invalid');
  if (
    !uuidSchema.safeParse(candidate.id).success ||
    !uuidSchema.safeParse(candidate.sourceId).success ||
    !uuidSchema.safeParse(candidate.revisionId).success
  )
    throw new DomainError('VALIDATION_FAILED', 'candidate identifiers are invalid');
  if (!candidateKinds.has(candidate.kind))
    throw new DomainError('VALIDATION_FAILED', 'candidate kind is invalid');
  if (
    !Number.isSafeInteger(candidate.startOffset) ||
    candidate.startOffset < 0 ||
    !Number.isSafeInteger(candidate.endOffset) ||
    candidate.endOffset <= candidate.startOffset ||
    candidate.endOffset > sourceText.length
  )
    throw new DomainError('VALIDATION_FAILED', 'candidate source offsets are invalid');
  const span = sourceText.slice(candidate.startOffset, candidate.endOffset);
  const marker = new RegExp(
    `^\\[${candidate.kind.toUpperCase()}:\\s*([^\\]\\r\\n]+)\\]$`,
    'u',
  ).exec(span);
  if (!marker || marker[1]?.trim() !== candidate.value)
    throw new DomainError(
      'EVIDENCE_MISSING',
      'candidate source span does not match the annotation',
    );
}
