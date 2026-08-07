import type { EntityId } from '@family-historian/contracts';
import { uuidSchema } from '@family-historian/contracts';
import { DomainError } from './errors.js';

export type PreservationCheck =
  | 'permissions'
  | 'departed_contributors'
  | 'share_links'
  | 'rights'
  | 'fixity'
  | 'new_interviews'
  | 'export_readiness';

export interface PreservationFinding {
  readonly check: PreservationCheck;
  readonly status: 'clear' | 'action_required';
  readonly detail: string;
}

export interface AnnualPreservationReview {
  readonly id: EntityId;
  readonly archiveId: EntityId;
  readonly reviewedAt: string;
  readonly findings: readonly PreservationFinding[];
  readonly status: 'ready' | 'action_required';
}

const checks: readonly PreservationCheck[] = [
  'permissions',
  'departed_contributors',
  'share_links',
  'rights',
  'fixity',
  'new_interviews',
  'export_readiness',
];

export function createAnnualPreservationReview(input: {
  id: EntityId;
  archiveId: EntityId;
  reviewedAt: string;
  findings: readonly PreservationFinding[];
}): AnnualPreservationReview {
  uuidSchema.parse(input.id);
  uuidSchema.parse(input.archiveId);
  if (!Number.isFinite(Date.parse(input.reviewedAt)))
    throw new DomainError('VALIDATION_FAILED', 'review date is invalid');
  const byCheck = new Map(input.findings.map((finding) => [finding.check, finding]));
  for (const check of checks) {
    const finding = byCheck.get(check);
    if (!finding)
      throw new DomainError('VALIDATION_FAILED', `preservation check missing: ${check}`);
    if (!finding.detail.trim())
      throw new DomainError('VALIDATION_FAILED', `preservation detail missing: ${check}`);
  }
  const findings = Object.freeze(checks.map((check) => Object.freeze(byCheck.get(check)!)));
  const status = findings.some((finding) => finding.status === 'action_required')
    ? 'action_required'
    : 'ready';
  return Object.freeze({
    id: input.id,
    archiveId: input.archiveId,
    reviewedAt: input.reviewedAt,
    findings,
    status,
  });
}

export function assertPreservationReviewReady(review: AnnualPreservationReview): void {
  if (review.status !== 'ready')
    throw new DomainError('CONFLICT', 'annual preservation review has unresolved actions');
}
