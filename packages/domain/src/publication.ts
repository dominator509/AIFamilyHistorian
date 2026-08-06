import { createHash } from 'node:crypto';
import type { EntityId, RightsStatus } from '@family-historian/contracts';
import { uuidSchema } from '@family-historian/contracts';
import { DomainError } from './errors.js';

export interface EditionSnapshot {
  readonly id: EntityId;
  readonly canonicalContent: string;
  readonly rightsStatus: RightsStatus;
  readonly unresolvedDisputeCount: number;
}

export interface PublicationApproval {
  readonly editionId: EntityId;
  readonly editionHash: string;
  readonly approverId: EntityId;
  readonly approvedAt: string;
}

export function hashEdition(edition: EditionSnapshot): string {
  return createHash('sha256').update(edition.canonicalContent, 'utf8').digest('hex');
}

export function approveEdition(
  edition: EditionSnapshot,
  approverId: EntityId,
  approvedAt: string,
): PublicationApproval {
  uuidSchema.parse(edition.id);
  uuidSchema.parse(approverId);
  if (edition.rightsStatus === 'disputed')
    throw new DomainError('RIGHTS_DISPUTED', 'edition rights are disputed');
  if (edition.rightsStatus !== 'verified')
    throw new DomainError('RIGHTS_UNVERIFIED', 'edition rights are not verified');
  if (edition.unresolvedDisputeCount > 0)
    throw new DomainError('RIGHTS_DISPUTED', 'edition contains unresolved disputes');
  return Object.freeze({
    editionId: edition.id,
    editionHash: hashEdition(edition),
    approverId,
    approvedAt,
  });
}

export function assertApprovalCurrent(
  edition: EditionSnapshot,
  approval: PublicationApproval,
): void {
  if (edition.id !== approval.editionId || hashEdition(edition) !== approval.editionHash) {
    throw new DomainError(
      'EDITION_STALE',
      'publication approval does not match the current edition',
    );
  }
}
