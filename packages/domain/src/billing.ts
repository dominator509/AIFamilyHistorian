import type { EntityId } from '@family-historian/contracts';
import { uuidSchema } from '@family-historian/contracts';
import { DomainError } from './errors.js';

export type PlanCode = 'concierge' | 'self_service' | 'family' | 'institutional';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';
export type UsageKind =
  'storage_bytes' | 'transcription_minutes' | 'narration_minutes' | 'print_orders' | 'member_seats';

export interface PlanLimits {
  readonly storageBytes: number;
  readonly transcriptionMinutes: number;
  readonly narrationMinutes: number;
  readonly printOrders: number;
  readonly memberSeats: number;
}

export interface PlanDefinition {
  readonly code: PlanCode;
  readonly displayName: string;
  readonly limits: PlanLimits;
  readonly trialDays: number;
  readonly graceDays: number;
}

export const planCatalog: Readonly<Record<PlanCode, PlanDefinition>> = Object.freeze({
  concierge: {
    code: 'concierge',
    displayName: 'Concierge',
    limits: {
      storageBytes: 250 * 1024 ** 3,
      transcriptionMinutes: 600,
      narrationMinutes: 300,
      printOrders: 4,
      memberSeats: 12,
    },
    trialDays: 14,
    graceDays: 7,
  },
  self_service: {
    code: 'self_service',
    displayName: 'Self-service',
    limits: {
      storageBytes: 50 * 1024 ** 3,
      transcriptionMinutes: 120,
      narrationMinutes: 60,
      printOrders: 1,
      memberSeats: 5,
    },
    trialDays: 14,
    graceDays: 7,
  },
  family: {
    code: 'family',
    displayName: 'Family',
    limits: {
      storageBytes: 150 * 1024 ** 3,
      transcriptionMinutes: 360,
      narrationMinutes: 180,
      printOrders: 3,
      memberSeats: 10,
    },
    trialDays: 30,
    graceDays: 14,
  },
  institutional: {
    code: 'institutional',
    displayName: 'Institutional',
    limits: {
      storageBytes: 2 * 1024 ** 4,
      transcriptionMinutes: 5_000,
      narrationMinutes: 2_000,
      printOrders: 50,
      memberSeats: 100,
    },
    trialDays: 30,
    graceDays: 30,
  },
});

export interface Subscription {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly planCode: PlanCode;
  readonly status: SubscriptionStatus;
  readonly trialEndsAt: string;
  readonly currentPeriodEndsAt: string;
  readonly graceEndsAt: string;
  readonly cancelledAt?: string;
  readonly providerSubscriptionId?: string;
}

export interface UsageRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly kind: UsageKind;
  readonly amount: number;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
}

export interface QuotaSnapshot {
  readonly kind: UsageKind;
  readonly limit: number;
  readonly used: number;
  readonly remaining: number;
}

export function startSubscription(input: {
  id: EntityId;
  organizationId: EntityId;
  planCode: PlanCode;
  startedAt: string;
  providerSubscriptionId?: string;
}): Subscription {
  uuidSchema.parse(input.id);
  uuidSchema.parse(input.organizationId);
  const plan = planCatalog[input.planCode];
  const start = Date.parse(input.startedAt);
  if (!Number.isFinite(start))
    throw new DomainError('VALIDATION_FAILED', 'subscription start is invalid');
  const trialEndsAt = new Date(start + plan.trialDays * 86_400_000).toISOString();
  const currentPeriodEndsAt = new Date(start + 30 * 86_400_000).toISOString();
  const graceEndsAt = new Date(start + (30 + plan.graceDays) * 86_400_000).toISOString();
  return Object.freeze({
    id: input.id,
    organizationId: input.organizationId,
    planCode: input.planCode,
    status: 'trialing',
    trialEndsAt,
    currentPeriodEndsAt,
    graceEndsAt,
    ...(input.providerSubscriptionId
      ? { providerSubscriptionId: input.providerSubscriptionId }
      : {}),
  });
}

export function transitionSubscription(
  subscription: Subscription,
  status: SubscriptionStatus,
  changedAt: string,
): Subscription {
  if (!Number.isFinite(Date.parse(changedAt)))
    throw new DomainError('VALIDATION_FAILED', 'billing event time is invalid');
  if (subscription.status === 'cancelled' && status !== 'cancelled')
    throw new DomainError(
      'CONFLICT',
      'cancelled subscriptions cannot be reactivated by webhook replay',
    );
  return Object.freeze({
    ...subscription,
    status,
    ...(status === 'cancelled' ? { cancelledAt: changedAt } : {}),
  });
}

export function appendUsage(
  records: readonly UsageRecord[],
  next: UsageRecord,
): readonly UsageRecord[] {
  uuidSchema.parse(next.id);
  uuidSchema.parse(next.organizationId);
  if (!Number.isFinite(next.amount) || next.amount < 0)
    throw new DomainError('VALIDATION_FAILED', 'usage amount must be nonnegative');
  if (!next.idempotencyKey.trim())
    throw new DomainError('VALIDATION_FAILED', 'usage idempotency key is required');
  const existing = records.find(
    (record) =>
      record.organizationId === next.organizationId &&
      record.idempotencyKey === next.idempotencyKey,
  );
  if (existing) {
    if (existing.kind !== next.kind || existing.amount !== next.amount)
      throw new DomainError('CONFLICT', 'usage idempotency key was reused with different data');
    return records;
  }
  return Object.freeze([...records, Object.freeze(next)]);
}

function limitFor(plan: PlanDefinition, kind: UsageKind): number {
  switch (kind) {
    case 'storage_bytes':
      return plan.limits.storageBytes;
    case 'transcription_minutes':
      return plan.limits.transcriptionMinutes;
    case 'narration_minutes':
      return plan.limits.narrationMinutes;
    case 'print_orders':
      return plan.limits.printOrders;
    case 'member_seats':
      return plan.limits.memberSeats;
  }
}

export function quotaSnapshot(
  subscription: Subscription,
  records: readonly UsageRecord[],
  kind: UsageKind,
): QuotaSnapshot {
  const used = records
    .filter(
      (record) => record.organizationId === subscription.organizationId && record.kind === kind,
    )
    .reduce((sum, record) => sum + record.amount, 0);
  const limit = limitFor(planCatalog[subscription.planCode], kind);
  return Object.freeze({ kind, limit, used, remaining: Math.max(0, limit - used) });
}

export function assertQuotaAvailable(
  subscription: Subscription,
  records: readonly UsageRecord[],
  kind: UsageKind,
  additionalAmount: number,
  now: string,
): void {
  if (!Number.isFinite(additionalAmount) || additionalAmount < 0)
    throw new DomainError('VALIDATION_FAILED', 'requested usage must be nonnegative');
  const nowMs = Date.parse(now);
  const graceEndsAtMs = Date.parse(subscription.graceEndsAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(graceEndsAtMs))
    throw new DomainError('VALIDATION_FAILED', 'billing quota time is invalid');
  if (subscription.status === 'cancelled')
    throw new DomainError('QUOTA_EXCEEDED', 'subscription is cancelled');
  if (subscription.status === 'past_due' && nowMs > graceEndsAtMs)
    throw new DomainError('QUOTA_EXCEEDED', 'subscription grace period has expired');
  const snapshot = quotaSnapshot(subscription, records, kind);
  if (snapshot.used + additionalAmount > snapshot.limit)
    throw new DomainError('QUOTA_EXCEEDED', `${kind} quota exceeded`);
}
