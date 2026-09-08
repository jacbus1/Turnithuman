import JSZip from 'jszip';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export type SourceFormat = 'txt' | 'md' | 'docx' | 'pdf' | 'pptx';

export interface ParsedDocument {
  text: string;
  format: SourceFormat;
  name: string;
}

function extension(name: string): SourceFormat | null {
  const value = name.split('.').pop()?.toLocaleLowerCase();
  return value && ['txt', 'md', 'docx', 'pdf', 'pptx'].includes(value) ? (value as SourceFormat) : null;
}

function cleanExtractedText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function parseDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const input = typeof window === 'undefined' ? { buffer: Buffer.from(buffer) } : { arrayBuffer: buffer };
  const result = await mammoth.extractRawText(input);
  return result.value;
}

async function parsePdf(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
  }
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ').trim();
    if (text) pages.push(`[Page ${pageNumber}]\n${text}`);
  }
  return pages.join('\n\n');
}

async function parsePptx(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/u.test(name))
    .sort((a, b) => Number(a.match(/\d+/u)?.[0]) - Number(b.match(/\d+/u)?.[0]));
  const slides: string[] = [];
  for (const [index, name] of slideNames.entries()) {
    const xml = await zip.file(name)?.async('string');
    if (!xml) continue;
    const values = [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/gu)].map((match) => decodeXml(match[1])).filter(Boolean);
    if (values.length) slides.push(`[Slide ${index + 1}]\n${values.join(' ')}`);
  }
  return slides.join('\n\n');
}

function decodeXml(value: string): string {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

export async function parseFile(file: File): Promise<ParsedDocument> {
  if (file.size > MAX_FILE_BYTES) throw new Error('檔案超過 20 MB 上限。');
  const format = extension(file.name);
  if (!format) throw new Error('不支援此檔案格式。請使用 TXT、MD、DOCX、PDF 或 PPTX。');
  try {
    const text = format === 'txt' || format === 'md'
      ? await file.text()
      : format === 'docx'
        ? await parseDocx(await file.arrayBuffer())
        : format === 'pdf'
          ? await parsePdf(await file.arrayBuffer())
          : await parsePptx(await file.arrayBuffer());
    const cleaned = cleanExtractedText(text);
    if (!cleaned) {
      throw new Error(format === 'pdf' ? 'PDF 沒有可讀文字層；掃描文件目前無法分析。' : '文件內沒有可分析的文字。');
    }
    return { text: cleaned, format, name: file.name };
  } catch (error) {
    if (error instanceof Error && /沒有|不支援|超過/u.test(error.message)) throw error;
    throw new Error(`無法讀取 ${format.toUpperCase()} 文件；檔案可能已加密或損壞。`);
  }
}
