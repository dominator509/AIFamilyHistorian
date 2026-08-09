import assert from 'node:assert/strict';
import { renderAccessibleEpub, renderAccessiblePdf } from '../../packages/documents/src/index.js';

const document = {
  title: 'A family story',
  author: 'An archivist',
  paragraphs: ['Approved text only.'],
};

const pdf = new TextDecoder().decode(renderAccessiblePdf(document));
assert.equal(pdf.slice(0, 8), '%PDF-1.4');
for (const marker of [
  '/Marked true',
  '/StructTreeRoot 6 0 R',
  '/StructParents 0',
  '/S /H1',
  '/S /P',
  '/MCID 0',
  'BDC',
  'EMC',
  '/ParentTree',
])
  assert.ok(pdf.includes(marker), `tagged PDF marker missing: ${marker}`);

const epub = new TextDecoder().decode(renderAccessibleEpub(document));
for (const marker of [
  'META-INF/container.xml',
  'OEBPS/package.opf',
  'OEBPS/nav.xhtml',
  'lang="en"',
  '<h1>',
  'epub:type="toc"',
  '<dc:language>en</dc:language>',
])
  assert.ok(epub.includes(marker), `EPUB accessibility marker missing: ${marker}`);

console.log('accessibility: ok pdf_tagged=true epub_semantics=true');
