import { describe, expect, it } from 'vitest';
import {
  advanceDeletion,
  approveEdition,
  assertActiveConsent,
  assertApprovalCurrent,
  assertCanApproveEdition,
  assertItemReadable,
  authorizeSelfVoice,
  authorizeStockVoice,
  beginDeletion,
  confirmFact,
  createDisputedClaim,
  createGeneratedChapterRevision,
  createQuotation,
  DomainError,
  withdrawConsent,
  type ConsentRecord,
  type DeletionEvidence,
} from '../../../packages/domain/src/index.js';
import type { EvidenceLink } from '../../../packages/contracts/src/index.js';

const ids = {
  fact: '019fd8a1-f366-7961-b027-89cf42f5c218',
  actor: '019fd8a1-f366-7961-b027-89cf42f5c219',
  evidence: '019fd8a1-f366-7961-b027-89cf42f5c220',
  source: '019fd8a1-f366-7961-b027-89cf42f5c221',
  revision: '019fd8a1-f366-7961-b027-89cf42f5c222',
  claim: '019fd8a1-f366-7961-b027-89cf42f5c223',
  account1: '019fd8a1-f366-7961-b027-89cf42f5c224',
  account2: '019fd8a1-f366-7961-b027-89cf42f5c225',
  quote: '019fd8a1-f366-7961-b027-89cf42f5c226',
  consent: '019fd8a1-f366-7961-b027-89cf42f5c227',
  edition: '019fd8a1-f366-7961-b027-89cf42f5c228',
  deletion: '019fd8a1-f366-7961-b027-89cf42f5c229',
  archive: '019fd8a1-f366-7961-b027-89cf42f5c230',
  chapter: '019fd8a1-f366-7961-b027-89cf42f5c231',
} as const;

const evidence: EvidenceLink = {
  id: ids.evidence,
  sourceId: ids.source,
  revisionId: ids.revision,
  startOffset: 4,
  endOffset: 19,
};

function expectCode(action: () => unknown, code: DomainError['code']): void {
  try {
    action();
    throw new Error('expected DomainError');
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
  }
}

describe('authoritative fact and dispute invariants', () => {
  it('requires evidence before a candidate becomes a confirmed fact', () => {
    expectCode(
      () =>
        confirmFact({
          id: ids.fact,
          text: 'Born near the river',
          confirmerId: ids.actor,
          confirmedAt: '2026-08-06T00:00:00.000Z',
          evidence: [],
        }),
      'EVIDENCE_MISSING',
    );
    const fact = confirmFact({
      id: ids.fact,
      text: 'Born near the river',
      confirmerId: ids.actor,
      confirmedAt: '2026-08-06T00:00:00.000Z',
      evidence: [evidence],
    });
    expect(fact.evidence).toEqual([evidence]);
    expect(Object.isFrozen(fact)).toBe(true);
  });

  it('rejects evidence offsets that cannot be represented safely', () => {
    expectCode(
      () =>
        confirmFact({
          id: ids.fact,
          text: 'Unsafe offset',
          confirmerId: ids.actor,
          confirmedAt: '2026-08-06T00:00:00.000Z',
          evidence: [
            {
              ...evidence,
              startOffset: Number.MAX_SAFE_INTEGER + 1,
              endOffset: Number.MAX_SAFE_INTEGER + 2,
            },
          ],
        }),
      'VALIDATION_FAILED',
    );
  });

  it('preserves competing recollections instead of forcing agreement', () => {
    const dispute = createDisputedClaim(ids.claim, [
      { id: ids.account1, text: 'The move happened in spring.', evidence: [evidence] },
      { id: ids.account2, text: 'The move happened after harvest.', evidence: [] },
    ]);
    expect(dispute.resolution).toBe('unresolved');
    expect(dispute.accounts).toHaveLength(2);
  });
});

describe('quotation lineage invariant', () => {
  const span = {
    id: ids.evidence,
    revisionId: ids.revision,
    text: 'We crossed at dawn.',
    approved: true,
    startOffset: 12,
    endOffset: 31,
  } as const;
  it('accepts only byte-exact approved text', () => {
    expect(createQuotation(ids.quote, span.text, span).text).toBe(span.text);
    expectCode(
      () => createQuotation(ids.quote, 'We crossed at sunrise.', span),
      'QUOTE_NOT_APPROVED',
    );
    expectCode(
      () => createQuotation(ids.quote, span.text, { ...span, approved: false }),
      'QUOTE_NOT_APPROVED',
    );
    expectCode(
      () =>
        createQuotation(ids.quote, span.text, {
          ...span,
          startOffset: Number.MAX_SAFE_INTEGER + 1,
          endOffset: Number.MAX_SAFE_INTEGER + 2,
        }),
      'VALIDATION_FAILED',
    );
    expectCode(
      () => createQuotation(ids.quote, span.text, { ...span, endOffset: span.endOffset + 1 }),
      'VALIDATION_FAILED',
    );
  });
});

describe('purpose-specific consent invariant', () => {
  const granted: ConsentRecord = {
    id: ids.consent,
    subjectId: ids.actor,
    purpose: 'transcription',
    policyVersion: '2026-08-01',
    status: 'granted',
    decidedAt: '2026-08-06T00:00:00.000Z',
  };
  it('does not let one consent purpose authorize another', () => {
    expect(assertActiveConsent([granted], ids.actor, 'transcription')).toBe(granted);
    expectCode(() => assertActiveConsent([granted], ids.actor, 'ai_editorial'), 'CONSENT_REQUIRED');
  });
  it('withdraws idempotently and blocks future use', () => {
    const withdrawn = withdrawConsent(granted, '2026-08-07T00:00:00.000Z');
    expect(withdrawConsent(withdrawn, '2026-08-08T00:00:00.000Z')).toBe(withdrawn);
    expectCode(
      () => assertActiveConsent([granted, withdrawn], ids.actor, 'transcription'),
      'CONSENT_WITHDRAWN',
    );
  });
});

describe('voice authorization invariant', () => {
  it('permits licensed stock and living-subject verified self voice only', () => {
    expect(authorizeStockVoice('license-2026-001').kind).toBe('stock');
    expect(
      authorizeSelfVoice({
        subjectId: ids.actor,
        providerVerificationReference: 'verified-001',
        subjectIsLiving: true,
      }).kind,
    ).toBe('verified_self_voice');
    expectCode(
      () =>
        authorizeSelfVoice({
          subjectId: ids.actor,
          providerVerificationReference: 'verified-001',
          subjectIsLiving: false,
        }),
      'PROVIDER_POLICY_REJECTED',
    );
  });
});

describe('edition approval invariant', () => {
  it('pins a rights-cleared immutable hash and invalidates changed content', () => {
    const edition = {
      id: ids.edition,
      canonicalContent: '{"chapter":"one"}',
      rightsStatus: 'verified',
      unresolvedDisputeCount: 0,
    } as const;
    const approval = approveEdition(edition, ids.actor, '2026-08-06T00:00:00.000Z');
    expect(() => assertApprovalCurrent(edition, approval)).not.toThrow();
    expectCode(
      () =>
        assertApprovalCurrent({ ...edition, canonicalContent: '{"chapter":"changed"}' }, approval),
      'EDITION_STALE',
    );
    expectCode(
      () =>
        approveEdition(
          { ...edition, rightsStatus: 'disputed' },
          ids.actor,
          '2026-08-06T00:00:00.000Z',
        ),
      'RIGHTS_DISPUTED',
    );
  });
});

describe('visibility and role invariants', () => {
  it('denies standing platform-admin access and editor approval', () => {
    expectCode(
      () =>
        assertItemReadable({
          role: 'platform_admin',
          visibility: 'family_members',
          rightsStatus: 'verified',
          isSelectedContributor: false,
          hasValidShareLink: false,
          embargoReleased: true,
          subjectConsentActive: true,
        }),
      'PERMISSION_DENIED',
    );
    expectCode(() => assertCanApproveEdition('editor'), 'PERMISSION_DENIED');
    expect(() => assertCanApproveEdition('archive_owner')).not.toThrow();
  });
});

describe('generated prose evidence invariant', () => {
  it('rejects unsupported facts while allowing labeled interpretation', () => {
    const base = {
      id: ids.chapter,
      model: 'deepseek-v4-flash',
      promptVersion: 'memoir-v1',
      archiveCapsuleVersion: 'capsule-v3',
      approverId: ids.actor,
    };
    expectCode(
      () =>
        createGeneratedChapterRevision({
          ...base,
          claims: [{ text: 'A factual date', classification: 'factual', evidence: [] }],
        }),
      'UNSUPPORTED_CLAIM',
    );
    expect(
      createGeneratedChapterRevision({
        ...base,
        claims: [
          { text: 'A reflective transition', classification: 'interpretation', evidence: [] },
        ],
      }).claims,
    ).toHaveLength(1);
  });

  it('rejects malformed generated and disputed evidence before persistence', () => {
    const base = {
      id: ids.chapter,
      model: 'deepseek-v4-flash',
      promptVersion: 'memoir-v1',
      archiveCapsuleVersion: 'capsule-v3',
      approverId: ids.actor,
    };
    const malformed = { ...evidence, startOffset: Number.MAX_SAFE_INTEGER + 1 };
    expectCode(
      () =>
        createGeneratedChapterRevision({
          ...base,
          claims: [{ text: 'A fact', classification: 'factual', evidence: [malformed] }],
        }),
      'VALIDATION_FAILED',
    );
    expectCode(
      () =>
        createDisputedClaim(ids.claim, [
          { id: ids.account1, text: 'One account', evidence: [malformed] },
          { id: ids.account2, text: 'Another account', evidence: [] },
        ]),
      'VALIDATION_FAILED',
    );
  });
});

describe('deletion workflow invariant', () => {
  it('is delayed, evidence-bearing, and idempotent after completion', () => {
    let workflow = beginDeletion(
      ids.deletion,
      ids.archive,
      '2026-08-06T00:00:00.000Z',
      '2026-08-07T00:00:00.000Z',
    );
    expectCode(() => advanceDeletion(workflow, '2026-08-06T12:00:00.000Z'), 'DELETION_PENDING');
    workflow = advanceDeletion(workflow, '2026-08-07T00:00:00.000Z');
    const entries: DeletionEvidence[] = [
      {
        target: 'primary_storage',
        reference: 'delete-marker-1',
        verifiedAt: '2026-08-07T01:00:00.000Z',
      },
      {
        target: 'derivatives',
        reference: 'delete-marker-2',
        verifiedAt: '2026-08-07T01:01:00.000Z',
      },
      {
        target: 'processor',
        reference: 'provider-receipt-1',
        verifiedAt: '2026-08-07T01:02:00.000Z',
      },
      {
        target: 'backup_tombstone',
        reference: 'tombstone-1',
        verifiedAt: '2026-08-07T01:03:00.000Z',
      },
    ];
    for (const entry of entries) {
      workflow = advanceDeletion(workflow, entry.verifiedAt, entry);
    }
    const completed = advanceDeletion(workflow, '2026-08-07T02:00:00.000Z');
    expect(completed.state).toBe('completed');
    expect(advanceDeletion(completed, '2026-08-08T00:00:00.000Z')).toBe(completed);
  });

  it('rejects invalid deletion timestamps and evidence proofs', () => {
    expect(() =>
      beginDeletion(ids.deletion, ids.archive, 'not-a-timestamp', '2026-08-07T00:00:00.000Z'),
    ).toThrow('deletion timestamps are invalid');
    const workflow = beginDeletion(
      ids.deletion,
      ids.archive,
      '2026-08-06T00:00:00.000Z',
      '2026-08-07T00:00:00.000Z',
    );
    const deleting = advanceDeletion(workflow, '2026-08-07T00:00:00.000Z');
    expect(() =>
      advanceDeletion(deleting, '2026-08-07T01:00:00.000Z', {
        target: 'primary_storage',
        reference: '',
        verifiedAt: 'not-a-timestamp',
      }),
    ).toThrow('deletion evidence is invalid');
  });
});
