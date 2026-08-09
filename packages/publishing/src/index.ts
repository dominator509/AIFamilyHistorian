import { createHash } from 'node:crypto';
import {
  buildPortableManifest,
  renderAccessibleEpub,
  renderAccessiblePdf,
  renderCsvIndex,
  renderJsonLines,
  type BookDocument,
  type ExportEntry,
} from '@family-historian/documents';
import { assertReleaseReady, type ReleaseReadinessReport } from '@family-historian/reports';

export interface ApprovedPublicationEdition {
  readonly editionId: string;
  /** Hash read from the authoritative current edition snapshot. */
  readonly editionHash: string;
  readonly archiveId: string;
  readonly generatedAt: string;
  readonly title: string;
  readonly author?: string;
  readonly paragraphs: readonly string[];
  readonly entries: readonly ExportEntry[];
  readonly readiness: ReleaseReadinessReport;
}

export interface PublicationArtifact {
  readonly format: 'pdf' | 'epub' | 'jsonl' | 'csv';
  readonly sha256: string;
  readonly byteSize: number;
  readonly bytes: Uint8Array;
}

export interface PublicationBundle {
  readonly editionId: string;
  readonly archiveId: string;
  readonly editionHash: string;
  readonly artifacts: readonly PublicationArtifact[];
  readonly portableManifest: ReturnType<typeof buildPortableManifest>;
}

/** Enforce the release report before rendering any customer-facing artifact. */
export function buildPublicationBundle(input: ApprovedPublicationEdition): PublicationBundle {
  assertReleaseReady(input.readiness);
  if (input.readiness.editionId !== input.editionId)
    throw new Error('publication readiness report targets a different edition');
  if (!/^[a-f0-9]{64}$/u.test(input.editionHash))
    throw new Error('current edition hash is invalid');
  if (input.readiness.editionHash !== input.editionHash)
    throw new Error('publication readiness report targets a stale edition hash');
  const document: BookDocument = {
    title: input.title,
    ...(input.author ? { author: input.author } : {}),
    paragraphs: input.paragraphs,
  };
  const jsonl = renderJsonLines(input.entries);
  const artifacts: readonly PublicationArtifact[] = [
    artifact('pdf', renderAccessiblePdf(document)),
    artifact('epub', renderAccessibleEpub(document)),
    artifact('jsonl', jsonl),
    artifact('csv', renderCsvIndex(input.entries)),
  ];
  const portableManifest = buildPortableManifest(
    input.archiveId,
    input.generatedAt,
    jsonl,
    input.entries.length,
  );
  return Object.freeze({
    editionId: input.editionId,
    archiveId: input.archiveId,
    editionHash: input.editionHash,
    artifacts: Object.freeze(artifacts),
    portableManifest,
  });
}

export interface NarrationManifest {
  readonly editionId: string;
  readonly voiceAuthorizationId: string;
  readonly chapters: readonly { readonly ordinal: number; readonly text: string }[];
}

/** Keep narration input explicit and authorization-bound; synthesis remains a provider adapter concern. */
export function buildNarrationManifest(input: {
  readonly editionId: string;
  readonly voiceAuthorizationId: string;
  readonly paragraphs: readonly string[];
}): NarrationManifest {
  if (!input.voiceAuthorizationId) throw new Error('voice authorization is required');
  return Object.freeze({
    editionId: input.editionId,
    voiceAuthorizationId: input.voiceAuthorizationId,
    chapters: Object.freeze(
      input.paragraphs.map((text, index) => Object.freeze({ ordinal: index + 1, text })),
    ),
  });
}

function artifact(format: PublicationArtifact['format'], bytes: Uint8Array): PublicationArtifact {
  return Object.freeze({
    format,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    byteSize: bytes.byteLength,
    bytes,
  });
}
