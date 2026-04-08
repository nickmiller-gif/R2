import { getDocument } from 'https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.mjs';
import mammoth from 'https://esm.sh/mammoth@1.8.0';

export interface ExtractDocumentInput {
  bytes: Uint8Array;
  contentType?: string;
  fileName?: string;
  titleHint?: string;
}

export interface ExtractDocumentResult {
  title: string;
  body: string;
  contentType: string;
  extractedFrom: 'text' | 'pdf' | 'docx';
  byteLength: number;
  truncated: boolean;
}

function readMaxBytes(): number {
  const raw = Deno.env.get('EIGEN_INGEST_MAX_BYTES') ?? `${10 * 1024 * 1024}`;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1024) return 10 * 1024 * 1024;
  return Math.min(n, 50 * 1024 * 1024);
}

function readMaxExtractChars(): number {
  const raw = Deno.env.get('EIGEN_INGEST_MAX_EXTRACT_CHARS') ?? '250000';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 5000) return 250000;
  return Math.min(n, 2_000_000);
}

function readMaxPdfPages(): number {
  const raw = Deno.env.get('EIGEN_INGEST_MAX_PDF_PAGES') ?? '120';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 120;
  return Math.min(n, 1000);
}

function baseName(fileName?: string): string {
  if (!fileName || fileName.trim().length === 0) return 'Uploaded document';
  const normalized = fileName.replace(/\\/g, '/');
  const leaf = normalized.split('/').pop() ?? normalized;
  const withoutExt = leaf.replace(/\.[^/.]+$/, '').trim();
  return withoutExt.length > 0 ? withoutExt : 'Uploaded document';
}

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function inferContentType(contentType: string | undefined, fileName: string | undefined): string {
  if (contentType && contentType.trim().length > 0) {
    return contentType.split(';')[0]!.trim().toLowerCase();
  }
  const lower = (fileName ?? '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
}

function clampText(value: string): { text: string; truncated: boolean } {
  const maxChars = readMaxExtractChars();
  if (value.length <= maxChars) return { text: value, truncated: false };
  return { text: value.slice(0, maxChars), truncated: true };
}

async function extractPdf(bytes: Uint8Array): Promise<{ text: string; truncated: boolean }> {
  const task = getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false,
  });
  const pdf = await task.promise;
  const maxPages = Math.min(pdf.numPages, readMaxPdfPages());

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const text = await page.getTextContent();
    const chunks = text.items
      .map((item) => {
        const candidate = item as { str?: string };
        return typeof candidate.str === 'string' ? candidate.str : '';
      })
      .filter((value) => value.length > 0);
    pages.push(chunks.join(' '));
    if (pages.join('\n\n').length >= readMaxExtractChars()) {
      break;
    }
  }
  return clampText(normalizeWhitespace(pages.join('\n\n')));
}

async function extractDocx(bytes: Uint8Array): Promise<{ text: string; truncated: boolean }> {
  const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
  return clampText(normalizeWhitespace(result.value ?? ''));
}

function extractPlainText(bytes: Uint8Array): { text: string; truncated: boolean } {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return clampText(normalizeWhitespace(decoder.decode(bytes)));
}

export async function extractDocumentText(input: ExtractDocumentInput): Promise<ExtractDocumentResult> {
  const byteLength = input.bytes.byteLength;
  const maxBytes = readMaxBytes();
  if (byteLength > maxBytes) {
    throw new Error(`File too large: ${byteLength} bytes exceeds ${maxBytes} byte limit`);
  }

  const contentType = inferContentType(input.contentType, input.fileName);
  const title = (input.titleHint && input.titleHint.trim().length > 0)
    ? input.titleHint.trim()
    : baseName(input.fileName);

  if (
    contentType === 'text/plain' ||
    contentType === 'text/markdown' ||
    contentType === 'text/csv'
  ) {
    const extracted = extractPlainText(input.bytes);
    const body = extracted.text;
    if (!body) throw new Error('Extracted text is empty');
    return { title, body, contentType, extractedFrom: 'text', byteLength, truncated: extracted.truncated };
  }

  if (contentType === 'application/pdf') {
    const extracted = await extractPdf(input.bytes);
    const body = extracted.text;
    if (!body) throw new Error('PDF extraction produced no text');
    return { title, body, contentType, extractedFrom: 'pdf', byteLength, truncated: extracted.truncated };
  }

  if (
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const extracted = await extractDocx(input.bytes);
    const body = extracted.text;
    if (!body) throw new Error('DOCX extraction produced no text');
    return { title, body, contentType, extractedFrom: 'docx', byteLength, truncated: extracted.truncated };
  }

  throw new Error(`Unsupported content type for extraction: ${contentType}`);
}
