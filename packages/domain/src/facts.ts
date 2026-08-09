import type { EntityId, EvidenceLink } from '@family-historian/contracts';
import { evidenceLinkSchema, uuidSchema } from '@family-historian/contracts';
import { DomainError } from './errors.js';

export const MAX_DISPUTE_ACCOUNTS = 1_000;
export const MAX_DISPUTE_ACCOUNT_EVIDENCE = 1_000;

export interface ConfirmedFact {
  readonly id: EntityId;
  readonly text: string;
  readonly confirmerId: EntityId;
  readonly confirmedAt: string;
  readonly evidence: readonly EvidenceLink[];
  readonly disputeState: 'undisputed' | 'disputed';
}

export function confirmFact(input: Omit<ConfirmedFact, 'disputeState'>): ConfirmedFact {
  uuidSchema.parse(input.id);
  uuidSchema.parse(input.confirmerId);
  if (input.text.trim().length === 0)
    throw new DomainError('VALIDATION_FAILED', 'fact text is required');
  if (input.evidence.length === 0)
    throw new DomainError('EVIDENCE_MISSING', 'confirmed facts require evidence');
  for (const link of input.evidence)
    if (!evidenceLinkSchema.safeParse(link).success)
      throw new DomainError('VALIDATION_FAILED', 'evidence link is invalid');
  return Object.freeze({
    ...input,
    evidence: Object.freeze([...input.evidence]),
    disputeState: 'undisputed',
  });
}

export interface ClaimAccount {
  readonly id: EntityId;
  readonly text: string;
  readonly evidence: readonly EvidenceLink[];
}

export interface DisputedClaim {
  readonly id: EntityId;
  readonly accounts: readonly ClaimAccount[];
  readonly resolution: 'unresolved' | 'context_added' | 'resolved_by_owner';
}

export function createDisputedClaim(
  id: EntityId,
  accounts: readonly ClaimAccount[],
): DisputedClaim {
  uuidSchema.parse(id);
  if (accounts.length < 2)
    throw new DomainError('VALIDATION_FAILED', 'a dispute requires competing accounts');
  if (accounts.length > MAX_DISPUTE_ACCOUNTS)
    throw new DomainError('VALIDATION_FAILED', 'dispute account count is invalid');
  for (const account of accounts) {
    uuidSchema.parse(account.id);
    if (account.text.trim().length === 0)
      throw new DomainError('VALIDATION_FAILED', 'claim text is required');
    if (account.evidence.length > MAX_DISPUTE_ACCOUNT_EVIDENCE)
      throw new DomainError('VALIDATION_FAILED', 'dispute evidence count is invalid');
    if (account.evidence.some((link) => !evidenceLinkSchema.safeParse(link).success))
      throw new DomainError('VALIDATION_FAILED', 'dispute evidence is invalid');
  }
  return Object.freeze({
    id,
    accounts: Object.freeze(
      accounts.map((account) =>
        Object.freeze({ ...account, evidence: Object.freeze([...account.evidence]) }),
      ),
    ),
    resolution: 'unresolved',
  });
}
