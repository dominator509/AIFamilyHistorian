#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { argv, env } from 'node:process';
import { z } from 'zod';
import {
  authorizeSelfVoice,
  authorizeStockVoice,
  assertActiveConsent,
  assertApprovalCurrent,
  assertItemReadable,
  assertPreservationReviewReady,
  assertQuotaAvailable,
  appendUsage,
  approveEdition,
  advanceDeletion,
  beginDeletion,
  confirmFact,
  createAnnualPreservationReview,
  createDisputedClaim,
  createGeneratedChapterRevision,
  createQuotation,
  assertCandidateEvidence,
  extractAnnotatedCandidates,
  quotaSnapshot,
  startSubscription,
  transitionSubscription,
  withdrawConsent,
} from '../../packages/domain/src/index.js';
import { DomainError } from '../../packages/domain/src/errors.js';
import { AiGateway, DeepSeekProvider } from '../../packages/ai-gateway/src/index.js';
import {
  buildPortableManifest,
  renderAccessibleEpub,
  renderAccessiblePdf,
  renderCsvIndex,
  renderJsonLines,
  type ExportEntry,
} from '../../packages/documents/src/index.js';
import {
  bootstrapArchive,
  createPool,
  migrate,
  uuidV7,
  withTenantTransaction,
} from '../../packages/database/src/index.js';
import {
  ObjectStorage,
  originalObjectKey,
  parseStorageConfig,
} from '../../packages/storage/src/index.js';
import { issueSessionToken, verifySessionToken } from '../../packages/auth/src/index.js';

const KNOWN_PROOFS = [
  'archive-membership',
  'consented-interview',
  'multipart-media-ingestion',
  'evidence-extraction',
  'timeline-disputes',
  'cited-memoir-draft',
  'book-pdf-epub',
  'authorized-narration',
  'private-family-portal',
  'portable-export',
  'verified-deletion',
  'rights-and-consent',
  'sensitive-claim-gate',
  'ai-cache-telemetry',
  'billing-and-quotas',
  'annual-preservation-review',
] as const;

type Proof = (typeof KNOWN_PROOFS)[number];

class DeferredProofError extends Error {
  public readonly deferred = true;

  public constructor(message: string) {
    super(message);
    this.name = 'DeferredProofError';
  }
}

function usage(): void {
  const lines = [
    'usage: run.ts --proof <name>',
    'usage: run.ts --list',
    'known proofs:',
    ...KNOWN_PROOFS.map((proof) => `  - ${proof}`),
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

function parseArgs(): { proof?: string; list: boolean } {
  const args = argv.slice(2);
  if (args.includes('--list')) return { list: true };
  const index = args.indexOf('--proof');
  return { list: false, proof: index >= 0 ? args[index + 1] : undefined };
}

function isProof(value: string): value is Proof {
  return (KNOWN_PROOFS as readonly string[]).includes(value);
}

function id(): string {
  return uuidV7();
}

function expectDomainCode(action: () => unknown, code: DomainError['code']): void {
  assert.throws(action, (error: unknown) => error instanceof DomainError && error.code === code);
}

function requireEnv(name: string): string {
  const value = env[name]?.trim();
  if (!value || value.startsWith('replace'))
    throw new DeferredProofError(`${name} is not configured`);
  return value;
}

async function archiveMembership(): Promise<void> {
  const pool = createPool(requireEnv('DATABASE_URL'));
  const context = { organizationId: id(), familyArchiveId: id() };
  const userId = id();
  try {
    await migrate(pool);
    await bootstrapArchive(pool, context, 'Live-fire family', 'Membership proof archive');
    await withTenantTransaction(pool, context, async (client) => {
      await client.query(
        "insert into memberships(id, organization_id, family_archive_id, user_id, role) values ($1,$2,$3,$4,'archive_owner')",
        [id(), context.organizationId, context.familyArchiveId, userId],
      );
      const result = await client.query<{ user_id: string; role: string }>(
        'select user_id, role from memberships where family_archive_id = $1 and user_id = $2',
        [context.familyArchiveId, userId],
      );
      assert.deepEqual(result.rows, [{ user_id: userId, role: 'archive_owner' }]);
    });
  } finally {
    await pool.end();
  }
}

function consentedInterview(): void {
  const subjectId = id();
  const consent = {
    id: id(),
    subjectId,
    purpose: 'recording' as const,
    policyVersion: '2026-08-06',
    status: 'granted' as const,
    decidedAt: '2026-08-06T00:00:00.000Z',
  };
  assert.equal(assertActiveConsent([consent], subjectId, 'recording').id, consent.id);
  const withdrawn = withdrawConsent(consent, '2026-08-06T00:01:00.000Z');
  expectDomainCode(
    () => assertActiveConsent([withdrawn], subjectId, 'recording'),
    'CONSENT_WITHDRAWN',
  );
  const token = issueSessionToken('live-fire-session-secret-that-is-long-enough', {
    userId: id(),
    organizationId: id(),
    archiveIds: [id()],
    permissions: ['archive:read'],
    expiresAt: Math.floor(Date.now() / 1000) + 300,
  });
  assert.equal(
    verifySessionToken('live-fire-session-secret-that-is-long-enough', token).permissions[0],
    'archive:read',
  );
}

async function multipartMediaIngestion(): Promise<void> {
  const storage = new ObjectStorage(parseStorageConfig(env));
  const key = originalObjectKey(id(), id());
  const bytes = new TextEncoder().encode('live-fire immutable media payload');
  const digest = createHash('sha256').update(bytes).digest('base64');
  let uploadId: string | undefined;
  try {
    uploadId = await storage.beginMultipart(key, 'text/plain', digest);
    const signed = await storage.signUploadPart(key, uploadId, 1);
    const response = await fetch(signed, {
      method: 'PUT',
      headers: { 'x-amz-checksum-sha256': digest },
      body: bytes,
    });
    if (!response.ok) {
      const detail = (await response.text()).replaceAll(/\s+/gu, ' ').slice(0, 240);
      throw new Error(`multipart part upload failed with ${response.status}: ${detail}`);
    }
    const etag = response.headers.get('etag');
    assert.ok(etag, 'multipart upload did not return an ETag');
    await storage.completeMultipart(key, uploadId, [
      { ETag: etag, PartNumber: 1, ChecksumSHA256: digest },
    ]);
    const head = await storage.head(key);
    assert.equal(head.byteSize, bytes.byteLength);
    assert.equal(head.expectedSha256, digest);
    assert.deepEqual(await storage.sha256Base64(key), {
      sha256Base64: digest,
      byteSize: bytes.byteLength,
    });
    assert.deepEqual(storageBytes(await storage.readBytes(key)), storageBytes(bytes));
    await storage.delete(key);
    await assert.rejects(() => storage.head(key));
    uploadId = undefined;
  } finally {
    if (uploadId) await storage.abortMultipart(key, uploadId).catch(() => undefined);
    await storage.delete(key).catch(() => undefined);
    storage.destroy();
  }
}

function storageBytes(value: Uint8Array): string {
  return Buffer.from(value).toString('hex');
}

function evidenceExtraction(): void {
  const sourceId = id();
  const revisionId = id();
  const sourceText = 'Interview note: [PERSON: Ada] moved to [PLACE: Halifax] in [DATE: 1984].';
  const candidates = extractAnnotatedCandidates({ text: sourceText, sourceId, revisionId });
  assert.equal(candidates.length, 3);
  assert.equal(candidates[0]?.status, 'candidate');
  for (const candidate of candidates) assertCandidateEvidence(candidate, sourceText);
  const fact = confirmFact({
    id: id(),
    text: 'The family moved in 1984.',
    confirmerId: id(),
    confirmedAt: '2026-08-06T00:00:00.000Z',
    evidence: [{ id: id(), sourceId, revisionId, startOffset: 58, endOffset: 70 }],
  });
  assert.equal(fact.evidence.length, 1);
  expectDomainCode(() => confirmFact({ ...fact, evidence: [] }), 'EVIDENCE_MISSING');
}

function timelineDisputes(): void {
  const claim = createDisputedClaim(id(), [
    { id: id(), text: 'The family arrived in spring.', evidence: [] },
    { id: id(), text: 'The family arrived in autumn.', evidence: [] },
  ]);
  assert.equal(claim.resolution, 'unresolved');
  assert.equal(claim.accounts.length, 2);
}

function citedMemoirDraft(): void {
  const source = {
    id: id(),
    revisionId: id(),
    text: 'We crossed the river at dawn.',
    approved: true,
    startOffset: 0,
    endOffset: 30,
  };
  const quotation = createQuotation(id(), source.text, source);
  assert.equal(quotation.text, source.text);
  const chapter = createGeneratedChapterRevision({
    id: id(),
    model: 'verified-live-fire',
    promptVersion: '1',
    archiveCapsuleVersion: '1',
    approverId: id(),
    claims: [
      {
        text: 'The journey began at dawn.',
        classification: 'factual',
        evidence: [
          {
            id: id(),
            sourceId: source.id,
            revisionId: source.revisionId,
            startOffset: 0,
            endOffset: 30,
          },
        ],
      },
      { text: 'The chapter connects the scene.', classification: 'connective_prose', evidence: [] },
    ],
  });
  assert.equal(chapter.claims.length, 2);
  expectDomainCode(
    () =>
      createGeneratedChapterRevision({
        ...chapter,
        claims: [{ text: 'unsupported', classification: 'factual', evidence: [] }],
      }),
    'UNSUPPORTED_CLAIM',
  );
}

function bookPdfEpub(): void {
  const document = {
    title: 'Live-fire family book',
    author: 'Family Historian',
    paragraphs: ['Approved source material is rendered without synthetic quotations.'],
  };
  const pdf = renderAccessiblePdf(document);
  assert.equal(new TextDecoder().decode(pdf.slice(0, 8)), '%PDF-1.4');
  assert.match(new TextDecoder().decode(pdf), /\/Marked true/u);
  const epub = renderAccessibleEpub(document);
  assert.equal(epub[0], 0x50);
  assert.equal(epub[1], 0x4b);
  const epubText = new TextDecoder().decode(epub);
  assert.match(epubText, /META-INF\/container\.xml/u);
  assert.match(epubText, /OEBPS\/package\.opf/u);
}

function authorizedNarration(): void {
  const stock = authorizeStockVoice('license-live-fire-1');
  assert.equal(stock.kind, 'stock');
  const self = authorizeSelfVoice({
    subjectId: id(),
    providerVerificationReference: 'provider-verification-live-fire-1',
    subjectIsLiving: true,
  });
  assert.equal(self.kind, 'verified_self_voice');
  expectDomainCode(
    () =>
      authorizeSelfVoice({
        subjectId: id(),
        providerVerificationReference: 'posthumous',
        subjectIsLiving: false,
      }),
    'PROVIDER_POLICY_REJECTED',
  );
}

function privateFamilyPortal(): void {
  const base = {
    role: 'viewer' as const,
    visibility: 'selected_contributors' as const,
    rightsStatus: 'verified' as const,
    isSelectedContributor: true,
    hasValidShareLink: false,
    embargoReleased: true,
    subjectConsentActive: true,
  };
  assert.doesNotThrow(() => assertItemReadable(base));
  expectDomainCode(
    () => assertItemReadable({ ...base, isSelectedContributor: false }),
    'PERMISSION_DENIED',
  );
  expectDomainCode(
    () => assertItemReadable({ ...base, rightsStatus: 'disputed' }),
    'RIGHTS_DISPUTED',
  );
}

function portableExport(): void {
  const entries: ExportEntry[] = [
    {
      type: 'confirmed_fact',
      id: id(),
      version: 1,
      visibility: 'owner_only',
      payload: { text: 'encrypted-value' },
      evidenceIds: [id()],
    },
  ];
  const jsonl = renderJsonLines(entries);
  const manifest = buildPortableManifest(id(), '2026-08-06T00:00:00.000Z', jsonl, entries.length);
  assert.equal(manifest.entriesSha256, createHash('sha256').update(jsonl).digest('hex'));
  assert.match(new TextDecoder().decode(renderCsvIndex(entries)), /confirmed_fact/u);
}

function verifiedDeletion(): void {
  let workflow = beginDeletion(id(), id(), '2026-08-06T00:00:00.000Z', '2026-08-06T00:01:00.000Z');
  expectDomainCode(() => advanceDeletion(workflow, '2026-08-06T00:00:30.000Z'), 'DELETION_PENDING');
  workflow = advanceDeletion(workflow, '2026-08-06T00:01:00.000Z');
  for (const target of [
    'primary_storage',
    'derivatives',
    'processor',
    'backup_tombstone',
  ] as const) {
    workflow = advanceDeletion(workflow, '2026-08-06T00:02:00.000Z', {
      target,
      reference: `live-fire-${target}`,
      verifiedAt: '2026-08-06T00:02:00.000Z',
    });
  }
  assert.equal(workflow.state, 'verifying');
  assert.equal(advanceDeletion(workflow, '2026-08-06T00:03:00.000Z').state, 'completed');
}

function rightsAndConsent(): void {
  const edition = {
    id: id(),
    canonicalContent: 'approved content',
    rightsStatus: 'verified' as const,
    unresolvedDisputeCount: 0,
  };
  const approval = approveEdition(edition, id(), '2026-08-06T00:00:00.000Z');
  assert.doesNotThrow(() => assertApprovalCurrent(edition, approval));
  expectDomainCode(
    () => approveEdition({ ...edition, rightsStatus: 'disputed' }, id(), approval.approvedAt),
    'RIGHTS_DISPUTED',
  );
  const consent = {
    id: id(),
    subjectId: id(),
    purpose: 'publication' as const,
    policyVersion: '1',
    status: 'granted' as const,
    decidedAt: approval.approvedAt,
  };
  assert.equal(assertActiveConsent([consent], consent.subjectId, 'publication').status, 'granted');
}

async function sensitiveClaimGate(): Promise<void> {
  const input = {
    editionId: id(),
    editionHash: 'a'.repeat(64),
    rights: [{ id: id(), label: 'portrait rights', status: 'ready' as const }],
    consents: [{ id: id(), label: 'publication consent', status: 'ready' as const }],
    citations: [
      {
        id: id(),
        label: 'sensitive allegation review',
        status: 'blocked' as const,
        reason: 'human review required',
      },
    ],
  };
  const { assertReleaseReady } = await import('../../packages/reports/src/index.js');
  assert.throws(
    () => assertReleaseReady(input),
    /sensitive allegation review: human review required/u,
  );
}

async function aiCacheTelemetry(): Promise<void> {
  const apiKey = requireEnv('DEEPSEEK_API_KEY');
  const gateway = new AiGateway(
    new DeepSeekProvider({ apiKey, timeoutMs: 20_000, maxAttempts: 2 }),
  );
  const request = {
    organizationId: id(),
    familyArchiveId: id(),
    purpose: 'interview_planning' as const,
    consentPurposes: ['interview_planning' as const],
    aiProcessingEnabled: true,
    promptFamily: 'live-fire-healthcheck',
    promptVersion: '1',
    policyVersion: '1',
    model: 'deepseek-chat',
    input: { task: 'return an empty claims list' },
    inputText: 'Return exactly an object with an empty claims array.',
    outputSchema: z.object({ claims: z.array(z.string()) }),
    maxInputTokens: 2_000,
  };
  const first = await gateway.execute(request);
  const second = await gateway.execute(request);
  assert.deepEqual(first.value, second.value);
  assert.equal(first.provenance.stablePrefixHash, second.provenance.stablePrefixHash);
  assert.ok(Number.isFinite(first.usage.cacheRatio));
  assert.ok(Number.isFinite(second.usage.cacheRatio));
}

function billingAndQuotas(): void {
  const startedAt = '2026-08-06T00:00:00.000Z';
  const subscription = startSubscription({
    id: id(),
    organizationId: id(),
    planCode: 'self_service',
    startedAt,
    providerSubscriptionId: 'stripe-subscription-live-fire',
  });
  let records = appendUsage([], {
    id: id(),
    organizationId: subscription.organizationId,
    kind: 'print_orders',
    amount: 1,
    idempotencyKey: 'print-order-1',
    occurredAt: startedAt,
  });
  records = appendUsage(records, { ...records[0]! });
  assert.equal(records.length, 1);
  assert.equal(quotaSnapshot(subscription, records, 'print_orders').remaining, 0);
  assertQuotaAvailable(subscription, records, 'print_orders', 0, startedAt);
  expectDomainCode(
    () => assertQuotaAvailable(subscription, records, 'print_orders', 1, startedAt),
    'QUOTA_EXCEEDED',
  );
  const active = transitionSubscription(subscription, 'active', startedAt);
  assert.equal(active.status, 'active');
  expectDomainCode(
    () =>
      transitionSubscription(
        transitionSubscription(active, 'cancelled', startedAt),
        'active',
        startedAt,
      ),
    'CONFLICT',
  );
}

function annualPreservationReview(): void {
  const checks = [
    'permissions',
    'departed_contributors',
    'share_links',
    'rights',
    'fixity',
    'new_interviews',
    'export_readiness',
  ] as const;
  const review = createAnnualPreservationReview({
    id: id(),
    archiveId: id(),
    reviewedAt: '2026-08-06T00:00:00.000Z',
    findings: checks.map((check) => ({
      check,
      status: 'clear' as const,
      detail: `verified ${check}`,
    })),
  });
  assert.equal(review.status, 'ready');
  assert.doesNotThrow(() => assertPreservationReviewReady(review));
  const actionRequired = createAnnualPreservationReview({
    ...review,
    findings: review.findings.map((finding) =>
      finding.check === 'fixity'
        ? { ...finding, status: 'action_required' as const, detail: 'repair required' }
        : finding,
    ),
  });
  assert.equal(actionRequired.status, 'action_required');
  expectDomainCode(() => assertPreservationReviewReady(actionRequired), 'CONFLICT');
}

const handlers: Record<Proof, () => void | Promise<void>> = {
  'archive-membership': archiveMembership,
  'consented-interview': consentedInterview,
  'multipart-media-ingestion': multipartMediaIngestion,
  'evidence-extraction': evidenceExtraction,
  'timeline-disputes': timelineDisputes,
  'cited-memoir-draft': citedMemoirDraft,
  'book-pdf-epub': bookPdfEpub,
  'authorized-narration': authorizedNarration,
  'private-family-portal': privateFamilyPortal,
  'portable-export': portableExport,
  'verified-deletion': verifiedDeletion,
  'rights-and-consent': rightsAndConsent,
  'sensitive-claim-gate': sensitiveClaimGate,
  'ai-cache-telemetry': aiCacheTelemetry,
  'billing-and-quotas': billingAndQuotas,
  'annual-preservation-review': annualPreservationReview,
};

async function main(): Promise<void> {
  if (typeof process.loadEnvFile === 'function') process.loadEnvFile('.env');
  const { proof, list } = parseArgs();
  if (list) {
    usage();
    return;
  }
  if (!proof || !isProof(proof)) {
    usage();
    process.exitCode = 2;
    return;
  }
  try {
    await handlers[proof]();
    process.stdout.write(`live-fire: proof ${proof} passed\n`);
  } catch (error) {
    if (error instanceof DeferredProofError) {
      process.stderr.write(`live-fire: proof ${proof} BLOCKED - ${error.message}\n`);
      process.exitCode = 3;
      return;
    }
    process.stderr.write(
      `live-fire: proof ${proof} FAILED - ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}

await main();
