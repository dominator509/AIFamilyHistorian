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
  const lines = entries.map((entry) => canonicalJson(exportEntrySchema.parse(entry)));
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
  if (!Number.isSafeInteger(entryCount) || entryCount < 0) throw new Error('EXPORT_COUNT_INVALID');
  const decoded = new TextDecoder().decode(jsonLines);
  const lines = decoded.length === 0 ? [] : decoded.split('\n').filter((line) => line.length > 0);
  for (const line of lines) exportEntrySchema.parse(JSON.parse(line));
  if (lines.length !== entryCount) throw new Error('EXPORT_COUNT_MISMATCH');
  return portableArchiveManifestSchema.parse({
    schemaVersion: '1',
    archiveId,
    generatedAt,
    entriesSha256: createHash('sha256').update(jsonLines).digest('hex'),
    entryCount,
    formats: ['jsonl', 'csv', 'media'],
  });
}

function canonicalJson(value: unknown): string {
  const normalized = normalizeJson(value);
  return JSON.stringify(normalized) ?? 'null';
}

function normalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalizeJson(nested)]),
    );
  return value;
}

export interface BookDocument {
  readonly title: string;
  readonly author?: string;
  readonly paragraphs: readonly string[];
}

/**
 * Render a deterministic, text-first PDF. The renderer intentionally accepts
 * only already-approved document text; it does not generate or infer content.
 */
export function renderAccessiblePdf(document: BookDocument): Uint8Array {
  const title = pdfText(document.title);
  const lines = [
    document.title,
    ...(document.author ? [`By ${document.author}`] : []),
    ...document.paragraphs.flatMap((paragraph) => [paragraph, '']),
  ];
  const commands = ['BT', '/F1 18 Tf', '72 760 Td'];
  for (const [index, line] of lines.entries()) {
    if (index > 0) commands.push('0 -24 Td');
    commands.push(`(${pdfText(line)}) Tj`);
  }
  commands.push('ET');
  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /Lang (en-US) /MarkInfo << /Marked true >> >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    `<< /Title (${title}) /Producer (AI Family Historian) >>`,
  ];
  let output = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) output += `${String(offset).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new TextEncoder().encode(output);
}

function pdfText(value: string): string {
  return value
    .normalize('NFKC')
    .replaceAll(/[\u0080-\uFFFF]/gu, '?')
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

/** Render a standards-shaped EPUB 3 archive with uncompressed, deterministic ZIP entries. */
export function renderAccessibleEpub(document: BookDocument): Uint8Array {
  const escapeXml = (value: string): string =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  const paragraphs = document.paragraphs
    .map((paragraph) => `<p>${escapeXml(paragraph)}</p>`)
    .join('');
  const title = escapeXml(document.title);
  const author = escapeXml(document.author ?? 'AI Family Historian');
  const entries: readonly ZipEntry[] = [
    { name: 'mimetype', data: new TextEncoder().encode('application/epub+zip') },
    {
      name: 'META-INF/container.xml',
      data: new TextEncoder().encode(
        '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
      ),
    },
    {
      name: 'OEBPS/content.xhtml',
      data: new TextEncoder().encode(
        `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>${title}</title></head><body><h1>${title}</h1><p>By ${author}</p>${paragraphs}</body></html>`,
      ),
    },
    {
      name: 'OEBPS/nav.xhtml',
      data: new TextEncoder().encode(
        `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en"><head><title>Contents</title></head><body><nav epub:type="toc" id="toc"><ol><li><a href="content.xhtml">${title}</a></li></ol></nav></body></html>`,
      ),
    },
    {
      name: 'OEBPS/package.opf',
      data: new TextEncoder().encode(
        `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="en"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:ai-family-historian</dc:identifier><dc:title>${title}</dc:title><dc:creator>${author}</dc:creator><dc:language>en</dc:language></metadata><manifest><item id="content" href="content.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="content"/></spine></package>`,
      ),
    },
  ];
  return buildStoredZip(entries);
}

interface ZipEntry {
  readonly name: string;
  readonly data: Uint8Array;
}

function buildStoredZip(entries: readonly ZipEntry[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length + entry.data.length);
    writeU32(local, 0, 0x04034b50);
    writeU16(local, 4, 20);
    writeU16(local, 14, 0);
    writeU32(local, 18, crc);
    writeU32(local, 22, entry.data.length);
    writeU32(local, 26, entry.data.length);
    writeU16(local, 28, name.length);
    local.set(name, 30);
    local.set(entry.data, 30 + name.length);
    chunks.push(local);

    const directory = new Uint8Array(46 + name.length);
    writeU32(directory, 0, 0x02014b50);
    writeU16(directory, 4, 20);
    writeU16(directory, 6, 20);
    writeU16(directory, 8, 0);
    writeU32(directory, 16, crc);
    writeU32(directory, 20, entry.data.length);
    writeU32(directory, 24, entry.data.length);
    writeU16(directory, 28, name.length);
    writeU32(directory, 42, offset);
    directory.set(name, 46);
    central.push(directory);
    offset += local.length;
  }
  const centralOffset = offset;
  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  writeU32(end, 0, 0x06054b50);
  writeU16(end, 8, entries.length);
  writeU16(end, 10, entries.length);
  writeU32(end, 12, centralSize);
  writeU32(end, 16, centralOffset);
  const result = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const chunk of chunks) {
    result.set(chunk, cursor);
    cursor += chunk.length;
  }
  for (const chunk of central) {
    result.set(chunk, cursor);
    cursor += chunk.length;
  }
  result.set(end, cursor);
  return result;
}

function writeU16(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeU32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
