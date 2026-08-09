import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  assertReleaseReady,
  type ReleaseReadinessReport,
} from '../../../packages/reports/src/index.js';
import {
  buildPortableManifest,
  renderCsvIndex,
  renderJsonLines,
  type ExportEntry,
} from '../../../packages/documents/src/index.js';

const entry: ExportEntry = {
  type: 'confirmed_fact',
  id: '01900000-0000-7000-8000-000000000001',
  version: 1,
  visibility: 'owner_only',
  payload: { text: 'encrypted-value' },
  evidenceIds: ['01900000-0000-7000-8000-000000000002'],
};

describe('portable documents and release reports', () => {
  it('renders deterministic open export formats with a fixity manifest', () => {
    const jsonl = renderJsonLines([entry]);
    const manifest = buildPortableManifest(
      '01900000-0000-7000-8000-000000000003',
      '2026-08-06T00:00:00.000Z',
      jsonl,
      1,
    );
    expect(manifest.entriesSha256).toBe(createHash('sha256').update(jsonl).digest('hex'));
    expect(new TextDecoder().decode(renderCsvIndex([entry]))).toContain('"confirmed_fact"');
  });

  it('fails closed when any rights, consent, or citation item is blocked', () => {
    const report: ReleaseReadinessReport = {
      editionId: '01900000-0000-7000-8000-000000000003',
      editionHash: 'a'.repeat(64),
      rights: [
        {
          id: '01900000-0000-7000-8000-000000000004',
          label: 'portrait rights',
          status: 'blocked',
          reason: 'unverified',
        },
      ],
      consents: [
        {
          id: '01900000-0000-7000-8000-000000000005',
          label: 'recording consent',
          status: 'ready',
        },
      ],
      citations: [
        {
          id: '01900000-0000-7000-8000-000000000006',
          label: 'citation coverage',
          status: 'ready',
        },
      ],
    };
    expect(() => assertReleaseReady(report)).toThrow(/portrait rights: unverified/u);
  });

  it('fails closed when a readiness category has no evidence', () => {
    const report: ReleaseReadinessReport = {
      editionId: '01900000-0000-7000-8000-000000000003',
      editionHash: 'a'.repeat(64),
      rights: [
        {
          id: '01900000-0000-7000-8000-000000000004',
          label: 'portrait rights',
          status: 'ready',
        },
      ],
      consents: [],
      citations: [
        {
          id: '01900000-0000-7000-8000-000000000005',
          label: 'citation coverage',
          status: 'ready',
        },
      ],
    };
    expect(() => assertReleaseReady(report)).toThrow(/too_small|array/u);
  });
});
