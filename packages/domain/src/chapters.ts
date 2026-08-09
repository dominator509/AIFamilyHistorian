import type { EntityId, EvidenceLink } from '@family-historian/contracts';
import { evidenceLinkSchema, uuidSchema } from '@family-historian/contracts';
import { DomainError } from './errors.js';

export const MAX_GENERATED_CLAIMS = 1_000;
export const MAX_GENERATED_CLAIM_EVIDENCE = 1_000;

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
  if (input.claims.length > MAX_GENERATED_CLAIMS)
    throw new DomainError('VALIDATION_FAILED', 'generated claim count is invalid');
  for (const claim of input.claims) {
    if (claim.text.trim().length === 0)
      throw new DomainError('VALIDATION_FAILED', 'claim text is required');
    if (claim.evidence.length > MAX_GENERATED_CLAIM_EVIDENCE)
      throw new DomainError('VALIDATION_FAILED', 'generated claim evidence count is invalid');
    if (claim.evidence.some((link) => !evidenceLinkSchema.safeParse(link).success))
      throw new DomainError('VALIDATION_FAILED', 'generated claim evidence is invalid');
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
