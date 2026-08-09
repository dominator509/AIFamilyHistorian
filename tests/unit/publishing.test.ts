import { describe, expect, it } from 'vitest';
import {
  buildNarrationManifest,
  buildPublicationBundle,
} from '../../packages/publishing/src/index.js';

const base = {
  editionId: '01900000-0000-7000-8000-000000000031',
  editionHash: 'a'.repeat(64),
  archiveId: '01900000-0000-7000-8000-000000000032',
  generatedAt: '2026-08-07T00:00:00.000Z',
  title: 'A Verified Story',
  paragraphs: ['A confirmed paragraph.'],
  entries: [
    {
      type: 'fact',
      id: '01900000-0000-7000-8000-000000000033',
      version: 1,
      visibility: 'owner_only',
      payload: { status: 'confirmed' },
      evidenceIds: ['01900000-0000-7000-8000-000000000034'],
    },
  ],
  readiness: {
    editionId: '01900000-0000-7000-8000-000000000031',
    editionHash: 'a'.repeat(64),
    rights: [
      { id: '01900000-0000-7000-8000-000000000035', label: 'rights', status: 'ready' as const },
    ],
    consents: [
      { id: '01900000-0000-7000-8000-000000000036', label: 'consent', status: 'ready' as const },
    ],
    citations: [
      { id: '01900000-0000-7000-8000-000000000037', label: 'citation', status: 'ready' as const },
    ],
  },
};

describe('publication boundary', () => {
  it('renders deterministic artifacts only after release readiness passes', () => {
    const bundle = buildPublicationBundle(base);
    expect(bundle.artifacts.map((artifact) => artifact.format)).toEqual([
      'pdf',
      'epub',
      'jsonl',
      'csv',
    ]);
    expect(bundle.artifacts.every((artifact) => artifact.sha256.length === 64)).toBe(true);
    expect(bundle.portableManifest.entryCount).toBe(1);
  });

  it('rejects readiness bound to a stale edition hash', () => {
    expect(() =>
      buildPublicationBundle({
        ...base,
        editionHash: 'b'.repeat(64),
      }),
    ).toThrow('stale edition hash');
  });

  it('keeps narration authorization explicit', () => {
    expect(buildNarrationManifest({ ...base, voiceAuthorizationId: 'voice-1' })).toMatchObject({
      voiceAuthorizationId: 'voice-1',
    });
    expect(() => buildNarrationManifest({ ...base, voiceAuthorizationId: '' })).toThrow(
      'voice authorization',
    );
  });
});
