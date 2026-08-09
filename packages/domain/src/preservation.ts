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
export const MAX_PRESERVATION_FINDINGS = checks.length;
export const MAX_PRESERVATION_DETAIL_CHARS = 2_048;

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
  const findingsValue: unknown = input.findings;
  if (!Array.isArray(findingsValue) || findingsValue.length > MAX_PRESERVATION_FINDINGS)
    throw new DomainError('VALIDATION_FAILED', 'preservation finding count is invalid');
  const seen = new Set<PreservationCheck>();
  const validatedFindings: PreservationFinding[] = [];
  for (const candidate of findingsValue) {
    if (candidate === null || typeof candidate !== 'object')
      throw new DomainError('VALIDATION_FAILED', 'preservation finding is invalid');
    const record = candidate as Record<string, unknown>;
    const check = record.check;
    const status = record.status;
    const detail = record.detail;
    if (!isPreservationCheck(check) || seen.has(check))
      throw new DomainError('VALIDATION_FAILED', 'preservation checks must be unique and known');
    if (
      (status !== 'clear' && status !== 'action_required') ||
      typeof detail !== 'string' ||
      !detail.trim() ||
      detail.length > MAX_PRESERVATION_DETAIL_CHARS
    )
      throw new DomainError('VALIDATION_FAILED', 'preservation finding is invalid');
    seen.add(check);
    validatedFindings.push({ check, status, detail });
  }
  const byCheck = new Map(validatedFindings.map((finding) => [finding.check, finding]));
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

function isPreservationCheck(value: unknown): value is PreservationCheck {
  return typeof value === 'string' && checks.includes(value as PreservationCheck);
}

export function assertPreservationReviewReady(review: AnnualPreservationReview): void {
  if (review.status !== 'ready')
    throw new DomainError('CONFLICT', 'annual preservation review has unresolved actions');
}
