import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { expect, it } from 'vitest';

import { MAX_FILE_BYTES, parseFile } from '../lib/parsers';

function asFile(parts: BlobPart[], name: string, type = 'application/octet-stream') {
  return new File(parts, name, { type });
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function minimalDocx() {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Private browser analysis</w:t></w:r></w:p></w:body></w:document>');
  return zip.generateAsync({ type: 'uint8array' });
}

async function minimalPptx() {
  const zip = new JSZip();
  zip.file('ppt/slides/slide2.xml', '<p:sld xmlns:p="p" xmlns:a="a"><a:t>Second slide</a:t></p:sld>');
  zip.file('ppt/slides/slide1.xml', '<p:sld xmlns:p="p" xmlns:a="a"><a:t>First &amp; local</a:t></p:sld>');
  return zip.generateAsync({ type: 'uint8array' });
}

it('parses TXT and Markdown as plain text', async () => {
  await expect(parseFile(asFile(['Hello\n\nworld'], 'sample.txt', 'text/plain'))).resolves.toMatchObject({ text: 'Hello\n\nworld', format: 'txt' });
  await expect(parseFile(asFile(['# Heading'], 'sample.md', 'text/markdown'))).resolves.toMatchObject({ text: '# Heading', format: 'md' });
});

it('extracts text from DOCX', async () => {
  const parsed = await parseFile(asFile([arrayBuffer(await minimalDocx())], 'sample.docx'));
  expect(parsed.text).toContain('Private browser analysis');
});

it('extracts PPTX slides in numeric order', async () => {
  const parsed = await parseFile(asFile([arrayBuffer(await minimalPptx())], 'sample.pptx'));
  expect(parsed.text).toBe('[Slide 1]\nFirst & local\n\n[Slide 2]\nSecond slide');
});

it('extracts selectable PDF text', async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText('Selectable PDF writing', { x: 40, y: 700, font });
  const parsed = await parseFile(asFile([arrayBuffer(await pdf.save())], 'sample.pdf', 'application/pdf'));
  expect(parsed.text).toContain('[Page 1]');
  expect(parsed.text).toContain('Selectable PDF writing');
});

it('rejects unsupported, oversized, and empty files', async () => {
  await expect(parseFile(asFile(['x'], 'sample.csv'))).rejects.toThrow('不支援');
  const oversized = { name: 'large.txt', size: MAX_FILE_BYTES + 1 } as File;
  await expect(parseFile(oversized)).rejects.toThrow('50 MB');
  await expect(parseFile(asFile(['   '], 'empty.txt'))).rejects.toThrow('沒有可分析');
});
