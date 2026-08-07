import { describe, expect, it } from 'vitest';
import {
  appendUsage,
  assertPreservationReviewReady,
  assertQuotaAvailable,
  createAnnualPreservationReview,
  quotaSnapshot,
  startSubscription,
} from '../../../packages/domain/src/index.js';

const checks = [
  'permissions',
  'departed_contributors',
  'share_links',
  'rights',
  'fixity',
  'new_interviews',
  'export_readiness',
] as const;

describe('billing and preservation invariants', () => {
  it('is idempotent and fail-closed at plan quotas', () => {
    const subscription = startSubscription({
      id: '01900000-0000-7000-8000-000000000001',
      organizationId: '01900000-0000-7000-8000-000000000002',
      planCode: 'self_service',
      startedAt: '2026-08-06T00:00:00.000Z',
    });
    const usage = {
      id: '01900000-0000-7000-8000-000000000003',
      organizationId: subscription.organizationId,
      kind: 'print_orders' as const,
      amount: 1,
      idempotencyKey: 'print-1',
      occurredAt: '2026-08-06T00:00:00.000Z',
    };
    const records = appendUsage(appendUsage([], usage), usage);
    expect(records).toHaveLength(1);
    expect(quotaSnapshot(subscription, records, 'print_orders').remaining).toBe(0);
    expect(() =>
      assertQuotaAvailable(subscription, records, 'print_orders', 1, '2026-08-06T00:00:00.000Z'),
    ).toThrow('quota exceeded');
  });

  it('requires every annual preservation check and blocks unresolved actions', () => {
    const review = createAnnualPreservationReview({
      id: '01900000-0000-7000-8000-000000000004',
      archiveId: '01900000-0000-7000-8000-000000000005',
      reviewedAt: '2026-08-06T00:00:00.000Z',
      findings: checks.map((check) => ({ check, status: 'clear' as const, detail: 'verified' })),
    });
    expect(review.status).toBe('ready');
    expect(() => assertPreservationReviewReady(review)).not.toThrow();
    const blocked = createAnnualPreservationReview({
      ...review,
      findings: review.findings.map((finding) =>
        finding.check === 'fixity'
          ? { ...finding, status: 'action_required' as const, detail: 'repair' }
          : finding,
      ),
    });
    expect(() => assertPreservationReviewReady(blocked)).toThrow('unresolved actions');
  });
});
