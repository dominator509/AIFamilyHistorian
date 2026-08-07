import { createHash } from 'node:crypto';
import { z } from 'zod';

export const exportEntrySchema = z.object({
  type: z.string().min(1),
  id: z.uuid(),
  version: z.number().int().positive(),
  visibility: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  evidenceIds: z.array(z.uuid()),
});
export type ExportEntry = z.infer<typeof exportEntrySchema>;

export const portableArchiveManifestSchema = z.object({
  schemaVersion: z.literal('1'),
  archiveId: z.uuid(),
  generatedAt: z.iso.datetime(),
  entriesSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  entryCount: z.number().int().nonnegative(),
  formats: z.array(z.enum(['jsonl', 'csv', 'media'])),
});
export type PortableArchiveManifest = z.infer<typeof portableArchiveManifestSchema>;

export function renderJsonLines(entries: readonly ExportEntry[]): Uint8Array {
  const lines = entries.map((entry) => JSON.stringify(exportEntrySchema.parse(entry)));
  return new TextEncoder().encode(lines.length === 0 ? '' : `${lines.join('\n')}\n`);
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function renderCsvIndex(entries: readonly ExportEntry[]): Uint8Array {
  const rows = ['type,id,version,visibility,evidence_ids'];
  for (const entry of entries) {
    const value = exportEntrySchema.parse(entry);
    rows.push(
      [
        csvCell(value.type),
        csvCell(value.id),
        String(value.version),
        csvCell(value.visibility),
        csvCell(value.evidenceIds.join(';')),
      ].join(','),
    );
  }
  return new TextEncoder().encode(`${rows.join('\r\n')}\r\n`);
}

export function buildPortableManifest(
  archiveId: string,
  generatedAt: string,
  jsonLines: Uint8Array,
  entryCount: number,
): PortableArchiveManifest {
  return portableArchiveManifestSchema.parse({
    schemaVersion: '1',
    archiveId,
    generatedAt,
    entriesSha256: createHash('sha256').update(jsonLines).digest('hex'),
    entryCount,
    formats: ['jsonl', 'csv', 'media'],
  });
}
