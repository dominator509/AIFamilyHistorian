import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  assertReleaseReady,
  type ReleaseReadinessReport,
} from '../../../packages/reports/src/index.js';
import {
  ExportCanonicalizationError,
  MAX_EXPORT_CANONICAL_DEPTH,
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

  it('fails closed on unsupported, non-finite, cyclic, and deeply nested payload values', () => {
    const withPayload = (payload: unknown): ExportEntry => ({ ...entry, payload });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => renderJsonLines([withPayload(cyclic)])).toThrowError(ExportCanonicalizationError);
    expect(() => renderJsonLines([withPayload({ value: Number.NaN })])).toThrowError(/non-finite/u);
    expect(() => renderJsonLines([withPayload({ value: undefined })])).toThrowError(/unsupported/u);
    let nested: unknown = 'leaf';
    for (let index = 0; index <= MAX_EXPORT_CANONICAL_DEPTH; index += 1) nested = { nested };
    expect(() => renderJsonLines([withPayload(nested)])).toThrowError(/nesting depth/u);
  });

  it('canonicalizes payload key order and binds the manifest count to JSONL entries', () => {
    const left = {
      ...entry,
      payload: { z: 'last', a: 'first' },
    };
    const right = {
      ...entry,
      payload: { a: 'first', z: 'last' },
    };
    const leftJsonl = renderJsonLines([left]);
    const rightJsonl = renderJsonLines([right]);
    expect(new TextDecoder().decode(leftJsonl)).toBe(new TextDecoder().decode(rightJsonl));
    expect(() =>
      buildPortableManifest(
        '01900000-0000-7000-8000-000000000003',
        '2026-08-06T00:00:00.000Z',
        leftJsonl,
        2,
      ),
    ).toThrow('EXPORT_COUNT_MISMATCH');
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
