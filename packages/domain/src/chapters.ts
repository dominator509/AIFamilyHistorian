import type { EntityId, EvidenceLink } from '@family-historian/contracts';
import { uuidSchema } from '@family-historian/contracts';
import { DomainError } from './errors.js';

export interface GeneratedClaim {
  readonly text: string;
  readonly classification: 'factual' | 'interpretation' | 'connective_prose';
  readonly evidence: readonly EvidenceLink[];
}

export interface GeneratedChapterRevision {
  readonly id: EntityId;
  readonly model: string;
  readonly promptVersion: string;
  readonly archiveCapsuleVersion: string;
  readonly claims: readonly GeneratedClaim[];
  readonly approverId: EntityId;
}

export function createGeneratedChapterRevision(
  input: GeneratedChapterRevision,
): GeneratedChapterRevision {
  uuidSchema.parse(input.id);
  uuidSchema.parse(input.approverId);
  if (!input.model || !input.promptVersion || !input.archiveCapsuleVersion)
    throw new DomainError('VALIDATION_FAILED', 'generation lineage is required');
  for (const claim of input.claims) {
    if (claim.text.trim().length === 0)
      throw new DomainError('VALIDATION_FAILED', 'claim text is required');
    if (claim.classification === 'factual' && claim.evidence.length === 0)
      throw new DomainError('UNSUPPORTED_CLAIM', 'factual generated claims require evidence');
  }
  return Object.freeze({
    ...input,
    claims: Object.freeze(
      input.claims.map((claim) =>
        Object.freeze({ ...claim, evidence: Object.freeze([...claim.evidence]) }),
      ),
    ),
  });
}
