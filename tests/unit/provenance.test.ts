import { describe, expect, it } from 'vitest';
import {
  assertClaimEvidence,
  buildProvenanceManifest,
  createEvidenceSpan,
  createProvenanceEvent,
  ProvenanceError,
  verifyProvenanceChain,
} from '../../packages/provenance/src/index.js';

const organizationId = '01900000-0000-7000-8000-000000000001';
const archiveId = '01900000-0000-7000-8000-000000000002';
const entityId = '01900000-0000-7000-8000-000000000003';

describe('provenance integrity', () => {
  it('creates and verifies a tamper-evident append-only chain', () => {
    const first = createProvenanceEvent({
      id: '01900000-0000-7000-8000-000000000010',
      organizationId,
      familyArchiveId: archiveId,
      entityType: 'chapter',
      entityId,
      eventType: 'created',
      lineage: { sourceIds: [entityId], promptVersion: 'v1' },
      occurredAt: '2026-08-07T00:00:00.000Z',
    });
    const second = createProvenanceEvent({
      id: '01900000-0000-7000-8000-000000000011',
      organizationId,
      familyArchiveId: archiveId,
      entityType: 'chapter',
      entityId,
      eventType: 'approved',
      lineage: { approverId: organizationId },
      occurredAt: '2026-08-07T00:01:00.000Z',
      previousHash: first.eventHash,
    });
    expect(() => verifyProvenanceChain([first, second])).not.toThrow();
    expect(buildProvenanceManifest([first, second])).toMatchObject({
      eventCount: 2,
      firstEventHash: first.eventHash,
      lastEventHash: second.eventHash,
    });
    expect(() => verifyProvenanceChain([{ ...second, eventType: 'tampered' }, first])).toThrow(
      ProvenanceError,
    );
  });

  it('rejects raw content in lineage and unsupported quotations', () => {
    expect(() =>
      createProvenanceEvent({
        id: '01900000-0000-7000-8000-000000000012',
        organizationId,
        familyArchiveId: archiveId,
        entityType: 'source',
        entityId,
        eventType: 'captured',
        lineage: { sourceText: 'do not persist raw source' },
        occurredAt: '2026-08-07T00:00:00.000Z',
      }),
    ).toThrow('lineage field is not allowed');
    const span = createEvidenceSpan(
      {
        sourceId: entityId,
        revisionId: archiveId,
        startOffset: 0,
        endOffset: 4,
      },
      'Ada moved',
    );
    expect(() =>
      assertClaimEvidence(
        { text: 'Ada', classification: 'quotation', evidence: [span] },
        'Ada moved',
      ),
    ).toThrow('quotation does not match');
    expect(() =>
      assertClaimEvidence(
        { text: 'Ada ', classification: 'quotation', evidence: [span] },
        'Ada moved',
      ),
    ).not.toThrow();
  });
});
