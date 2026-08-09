import type { EntityId } from '@family-historian/contracts';
import { uuidSchema } from '@family-historian/contracts';
import { DomainError } from './errors.js';

export type DeletionState = 'grace_period' | 'deleting' | 'verifying' | 'completed';

export interface DeletionEvidence {
  readonly target: 'primary_storage' | 'derivatives' | 'processor' | 'backup_tombstone';
  readonly reference: string;
  readonly verifiedAt: string;
}

export interface DeletionWorkflow {
  readonly id: EntityId;
  readonly archiveId: EntityId;
  readonly state: DeletionState;
  readonly requestedAt: string;
  readonly graceEndsAt: string;
  readonly evidence: readonly DeletionEvidence[];
}

export function beginDeletion(
  id: EntityId,
  archiveId: EntityId,
  requestedAt: string,
  graceEndsAt: string,
): DeletionWorkflow {
  uuidSchema.parse(id);
  uuidSchema.parse(archiveId);
  const requestedAtMs = Date.parse(requestedAt);
  const graceEndsAtMs = Date.parse(graceEndsAt);
  if (!Number.isFinite(requestedAtMs) || !Number.isFinite(graceEndsAtMs))
    throw new DomainError('VALIDATION_FAILED', 'deletion timestamps are invalid');
  if (graceEndsAtMs <= requestedAtMs)
    throw new DomainError('VALIDATION_FAILED', 'deletion grace period must end after request');
  return Object.freeze({
    id,
    archiveId,
    state: 'grace_period',
    requestedAt,
    graceEndsAt,
    evidence: Object.freeze([]),
  });
}

export function advanceDeletion(
  workflow: DeletionWorkflow,
  now: string,
  evidence?: DeletionEvidence,
): DeletionWorkflow {
  if (workflow.state === 'completed') return workflow;
  const nowMs = Date.parse(now);
  const graceEndsAtMs = Date.parse(workflow.graceEndsAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(graceEndsAtMs))
    throw new DomainError('VALIDATION_FAILED', 'deletion transition time is invalid');
  if (workflow.state === 'grace_period' && nowMs < graceEndsAtMs)
    throw new DomainError('DELETION_PENDING', 'deletion grace period is active', true);
  if (workflow.state === 'grace_period') return Object.freeze({ ...workflow, state: 'deleting' });
  if (workflow.state === 'deleting') {
    if (!evidence) throw new DomainError('EVIDENCE_MISSING', 'deletion evidence is required');
    validateEvidence(evidence);
    const exists = workflow.evidence.some(
      (item) => item.target === evidence.target && item.reference === evidence.reference,
    );
    const nextEvidence = exists
      ? workflow.evidence
      : Object.freeze([...workflow.evidence, Object.freeze(evidence)]);
    const targets = new Set(nextEvidence.map((item) => item.target));
    const readyToVerify = ['primary_storage', 'derivatives', 'processor', 'backup_tombstone'].every(
      (target) => targets.has(target as DeletionEvidence['target']),
    );
    return Object.freeze({
      ...workflow,
      state: readyToVerify ? 'verifying' : 'deleting',
      evidence: nextEvidence,
    });
  }
  const targets = new Set(workflow.evidence.map((item) => item.target));
  for (const required of [
    'primary_storage',
    'derivatives',
    'processor',
    'backup_tombstone',
  ] as const) {
    if (!targets.has(required))
      throw new DomainError('EVIDENCE_MISSING', `deletion evidence missing: ${required}`);
  }
  return Object.freeze({ ...workflow, state: 'completed' });
}

function validateEvidence(evidence: DeletionEvidence): void {
  if (
    !['primary_storage', 'derivatives', 'processor', 'backup_tombstone'].includes(
      evidence.target,
    ) ||
    !evidence.reference.trim() ||
    !Number.isFinite(Date.parse(evidence.verifiedAt))
  )
    throw new DomainError('VALIDATION_FAILED', 'deletion evidence is invalid');
}
