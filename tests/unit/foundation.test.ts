import { describe, expect, it } from 'vitest';
import {
  completeUploadInputSchema,
  editionInputSchema,
  MAX_FACT_TEXT_CHARS,
  MAX_EDITION_MANIFEST_BYTES,
  MAX_EDITION_MANIFEST_KEYS,
  MAX_TRANSCRIPT_TEXT_CHARS,
  factInputSchema,
  healthStatusSchema,
  MAX_MULTIPART_TOKEN_CHARS,
  transcriptInputSchema,
} from '../../packages/contracts/src/index.js';
import {
  MAX_OUTBOX_PAYLOAD_BYTES,
  MAX_PROVIDER_CALLBACK_PAYLOAD_BYTES,
  serializeProviderCallbackPayload,
  serializeOutboxPayload,
} from '../../apps/api/src/archive-service.js';

describe('foundation contracts', () => {
  it('rejects an unknown health state', () => {
    expect(() =>
      healthStatusSchema.parse({
        service: 'api',
        status: 'unknown',
        timestamp: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it('rejects duplicate multipart parts before provider completion', () => {
    expect(() =>
      completeUploadInputSchema.parse({
        parts: [
          { ETag: 'etag-1', PartNumber: 1 },
          { ETag: 'etag-2', PartNumber: 1 },
        ],
      }),
    ).toThrow('multipart part numbers must be unique');
  });

  it('bounds provider multipart tokens before provider completion', () => {
    expect(() =>
      completeUploadInputSchema.parse({
        parts: [{ ETag: 'x'.repeat(MAX_MULTIPART_TOKEN_CHARS + 1), PartNumber: 1 }],
      }),
    ).toThrow();
    expect(() =>
      completeUploadInputSchema.parse({
        parts: [
          {
            ETag: 'etag-1',
            PartNumber: 1,
            ChecksumSHA256: 'x'.repeat(MAX_MULTIPART_TOKEN_CHARS + 1),
          },
        ],
      }),
    ).toThrow();
  });

  it('bounds evidence-link fan-out before SQL persistence', () => {
    expect(() =>
      factInputSchema.parse({
        text: 'A fact',
        confirmerId: '01900000-0000-7000-8000-000000000001',
        evidenceLinkIds: Array.from(
          { length: 1_001 },
          () => '01900000-0000-7000-8000-000000000002',
        ),
      }),
    ).toThrow();
    expect(() =>
      factInputSchema.parse({
        text: 'x'.repeat(MAX_FACT_TEXT_CHARS + 1),
        confirmerId: '01900000-0000-7000-8000-000000000001',
        evidenceLinkIds: ['01900000-0000-7000-8000-000000000002'],
      }),
    ).toThrow();
    expect(() =>
      transcriptInputSchema.parse({
        mediaAssetId: '01900000-0000-7000-8000-000000000003',
        text: 'x'.repeat(MAX_TRANSCRIPT_TEXT_CHARS + 1),
      }),
    ).toThrow();
  });

  it('bounds edition manifests before JSONB persistence', () => {
    expect(() =>
      editionInputSchema.parse({
        editionHash: 'a'.repeat(64),
        manifest: Object.fromEntries(
          Array.from({ length: MAX_EDITION_MANIFEST_KEYS + 1 }, (_, index) => [
            String(index),
            true,
          ]),
        ),
      }),
    ).toThrow();
    expect(() =>
      editionInputSchema.parse({
        editionHash: 'a'.repeat(64),
        manifest: { text: 'x'.repeat(MAX_EDITION_MANIFEST_BYTES) },
      }),
    ).toThrow(/maximum size/u);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() =>
      editionInputSchema.parse({ editionHash: 'a'.repeat(64), manifest: cyclic }),
    ).toThrow(/serializable/u);
  });

  it('bounds provider callback payloads before JSONB persistence', () => {
    expect(() =>
      serializeProviderCallbackPayload({ body: 'x'.repeat(MAX_PROVIDER_CALLBACK_PAYLOAD_BYTES) }),
    ).toThrow(/size limit/u);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => serializeProviderCallbackPayload(cyclic)).toThrow(/serializable/u);
    expect(serializeProviderCallbackPayload({ ok: true })).toBe('{"ok":true}');
  });

  it('bounds durable outbox payloads before queue persistence', () => {
    expect(() =>
      serializeOutboxPayload('aggregate-1', { body: 'x'.repeat(MAX_OUTBOX_PAYLOAD_BYTES) }),
    ).toThrow(/size limit/u);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => serializeOutboxPayload('aggregate-1', cyclic)).toThrow(/serializable/u);
    expect(serializeOutboxPayload('aggregate-1', { kind: 'privacy.request' })).toBe(
      '{"aggregateId":"aggregate-1","payload":{"kind":"privacy.request"}}',
    );
  });
});
