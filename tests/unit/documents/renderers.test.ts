import { describe, expect, it } from 'vitest';
import {
  renderAccessibleEpub,
  renderAccessiblePdf,
} from '../../../packages/documents/src/index.js';

describe('accessible book renderers', () => {
  const document = {
    title: 'A family story',
    author: 'An archivist',
    paragraphs: ['Approved text only.'],
  };

  it('emits a deterministic accessible PDF structure', () => {
    const first = renderAccessiblePdf(document);
    const second = renderAccessiblePdf(document);
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    expect(new TextDecoder().decode(first.slice(0, 8))).toBe('%PDF-1.4');
    expect(new TextDecoder().decode(first)).toContain('/Marked true');
  });

  it('emits an EPUB container with navigation and package metadata', () => {
    const epub = new TextDecoder().decode(renderAccessibleEpub(document));
    expect(epub.startsWith('PK')).toBe(true);
    expect(epub).toContain('META-INF/container.xml');
    expect(epub).toContain('OEBPS/package.opf');
    expect(epub).toContain('OEBPS/nav.xhtml');
  });
});
