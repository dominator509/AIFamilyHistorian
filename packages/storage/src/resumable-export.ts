import { createHash } from 'node:crypto';
import type { EntityId } from '@family-historian/contracts';
import { uuidSchema } from '@family-historian/contracts';

export const MAX_EXPORT_BYTES = 25 * 1024 * 1024 * 1024;
export const DEFAULT_EXPORT_CHUNK_BYTES = 64 * 1024 * 1024;

export interface ExportChunkPlan {
  readonly partNumber: number;
  readonly offset: number;
  readonly byteSize: number;
}

export interface ResumableExportManifest {
  readonly exportId: EntityId;
  readonly archiveId: EntityId;
  readonly generatedAt: string;
  readonly totalBytes: number;
  readonly chunkSize: number;
  readonly chunks: readonly ExportChunkPlan[];
  readonly manifestSha256: string;
}

export function planResumableExport(input: {
  readonly exportId: EntityId;
  readonly archiveId: EntityId;
  readonly generatedAt: string;
  readonly totalBytes: number;
  readonly chunkSize?: number;
}): ResumableExportManifest {
  uuidSchema.parse(input.exportId);
  uuidSchema.parse(input.archiveId);
  if (
    !Number.isInteger(input.totalBytes) ||
    input.totalBytes <= 0 ||
    input.totalBytes > MAX_EXPORT_BYTES
  )
    throw new Error('EXPORT_SIZE_INVALID');
  const chunkSize = input.chunkSize ?? DEFAULT_EXPORT_CHUNK_BYTES;
  if (!Number.isInteger(chunkSize) || chunkSize < 5 * 1024 * 1024 || chunkSize > 512 * 1024 * 1024)
    throw new Error('EXPORT_CHUNK_SIZE_INVALID');
  const chunks: ExportChunkPlan[] = [];
  let offset = 0;
  let partNumber = 1;
  while (offset < input.totalBytes) {
    const byteSize = Math.min(chunkSize, input.totalBytes - offset);
    chunks.push(Object.freeze({ partNumber, offset, byteSize }));
    offset += byteSize;
    partNumber += 1;
  }
  const canonical = JSON.stringify({
    exportId: input.exportId,
    archiveId: input.archiveId,
    generatedAt: input.generatedAt,
    totalBytes: input.totalBytes,
    chunkSize,
    chunks,
  });
  return Object.freeze({
    exportId: input.exportId,
    archiveId: input.archiveId,
    generatedAt: input.generatedAt,
    totalBytes: input.totalBytes,
    chunkSize,
    chunks: Object.freeze(chunks),
    manifestSha256: createHash('sha256').update(canonical, 'utf8').digest('hex'),
  });
}

export function missingExportParts(
  manifest: ResumableExportManifest,
  completedPartNumbers: readonly number[],
): readonly number[] {
  const completed = new Set(completedPartNumbers);
  if ([...completed].some((part) => !Number.isInteger(part) || part < 1))
    throw new Error('EXPORT_PART_INVALID');
  return Object.freeze(
    manifest.chunks
      .map((chunk) => chunk.partNumber)
      .filter((partNumber) => !completed.has(partNumber)),
  );
}

export function assertExportComplete(
  manifest: ResumableExportManifest,
  completedPartNumbers: readonly number[],
): void {
  const missing = missingExportParts(manifest, completedPartNumbers);
  if (missing.length > 0) throw new Error(`EXPORT_INCOMPLETE:${missing.join(',')}`);
}
