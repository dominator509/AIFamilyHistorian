import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  assertReleaseReady,
  MAX_READINESS_ITEMS,
  MAX_READINESS_LABEL_CHARS,
  MAX_READINESS_REASON_CHARS,
  type ReleaseReadinessReport,
} from '../../../packages/reports/src/index.js';
import {
  ExportCanonicalizationError,
  MAX_EXPORT_CANONICAL_DEPTH,
  MAX_EXPORT_ENTRIES,
  MAX_EXPORT_JSONL_BYTES,
  MAX_BOOK_PARAGRAPHS,
  MAX_BOOK_TEXT_BYTES,
  buildPortableManifest,
  renderAccessibleEpub,
  renderAccessiblePdf,
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

  it('bounds export cardinality and serialized output before materialization', () => {
    expect(() =>
      renderJsonLines(Array.from({ length: MAX_EXPORT_ENTRIES + 1 }, () => entry)),
    ).toThrow('EXPORT_ENTRY_COUNT_EXCEEDED');
    expect(() =>
      renderJsonLines([{ ...entry, payload: { text: 'x'.repeat(MAX_EXPORT_JSONL_BYTES) } }]),
    ).toThrow(/EXPORT_ENTRY_TOO_LARGE|EXPORT_OUTPUT_TOO_LARGE/u);
    expect(() =>
      buildPortableManifest(
        '01900000-0000-7000-8000-000000000003',
        '2026-08-06T00:00:00.000Z',
        new Uint8Array(MAX_EXPORT_JSONL_BYTES + 1),
        0,
      ),
    ).toThrow('EXPORT_OUTPUT_TOO_LARGE');
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

  it('bounds readiness item text and category cardinality', () => {
    const item = {
      id: '01900000-0000-7000-8000-000000000004',
      label: 'rights',
      status: 'ready' as const,
    };
    const report: ReleaseReadinessReport = {
      editionId: '01900000-0000-7000-8000-000000000003',
      editionHash: 'a'.repeat(64),
      rights: [item],
      consents: [item],
      citations: [item],
    };
    expect(() =>
      assertReleaseReady({
        ...report,
        rights: [{ ...item, label: 'x'.repeat(MAX_READINESS_LABEL_CHARS + 1) }],
      }),
    ).toThrow(/too_big|max/u);
    expect(() =>
      assertReleaseReady({
        ...report,
        consents: [
          { ...item, reason: 'x'.repeat(MAX_READINESS_REASON_CHARS + 1), status: 'blocked' },
        ],
      }),
    ).toThrow(/too_big|max/u);
    expect(() =>
      assertReleaseReady({
        ...report,
        citations: Array.from({ length: MAX_READINESS_ITEMS + 1 }, (_, index) => ({
          ...item,
          id: `01900000-0000-7000-8000-${String(index + 100).padStart(12, '0')}`,
        })),
      }),
    ).toThrow(/too_big|max/u);
  });

  it('bounds PDF and EPUB document materialization', () => {
    expect(() => renderAccessiblePdf({ title: '', paragraphs: [] })).toThrow('title');
    expect(() =>
      renderAccessibleEpub({
        title: 'Family',
        paragraphs: Array.from({ length: MAX_BOOK_PARAGRAPHS + 1 }, () => 'chapter'),
      }),
    ).toThrow('paragraph count');
    expect(() =>
      renderAccessiblePdf({
        title: 'Family',
        paragraphs: ['x'.repeat(MAX_BOOK_TEXT_BYTES + 1)],
      }),
    ).toThrow('text exceeds');
    expect(() => renderAccessibleEpub({ title: 'Family', paragraphs: [null as never] })).toThrow(
      'paragraph',
    );
  });
});
