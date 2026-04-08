export type ChunkLevel = 'document' | 'section' | 'paragraph' | 'claim';

export interface IngestChunk {
  chunkLevel: ChunkLevel;
  headingPath: string[];
  content: string;
}

export interface QueryFilters {
  entityScope?: string[];
  policyScope?: string[];
}

export interface RetrievalCandidate {
  id: string;
  content: string;
  chunk_level: ChunkLevel;
  heading_path: string[];
  document_id: string;
  source_system: string;
  source_ref: string;
  valid_from: string | null;
  valid_to: string | null;
  entity_ids: string[];
  policy_tags: string[];
  similarity_score: number;
  authority_score: number;
  freshness_score: number;
  provenance_completeness: number;
}

const EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

function normalizeWhitespace(input: string): string {
  return input.replace(/\r\n/g, '\n').replace(/\t/g, ' ').replace(/[ ]{2,}/g, ' ').trim();
}

function splitParagraphs(body: string): string[] {
  return normalizeWhitespace(body)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function splitClaims(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 40);
}

export function buildChunks(title: string, body: string, mode: 'hierarchical' | 'flat'): IngestChunk[] {
  const normalizedBody = normalizeWhitespace(body);
  if (!normalizedBody) return [];

  const chunks: IngestChunk[] = [
    {
      chunkLevel: 'document',
      headingPath: [title],
      content: normalizedBody,
    },
  ];

  const paragraphs = splitParagraphs(normalizedBody);
  if (mode === 'flat') {
    for (const paragraph of paragraphs) {
      chunks.push({
        chunkLevel: 'paragraph',
        headingPath: [title],
        content: paragraph,
      });
    }
    return chunks;
  }

  const sectionSize = 4;
  for (let idx = 0; idx < paragraphs.length; idx += sectionSize) {
    const sectionIndex = Math.floor(idx / sectionSize) + 1;
    const sectionParagraphs = paragraphs.slice(idx, idx + sectionSize);
    const sectionName = `Section ${sectionIndex}`;
    chunks.push({
      chunkLevel: 'section',
      headingPath: [title, sectionName],
      content: sectionParagraphs.join('\n\n'),
    });

    for (let paragraphIndex = 0; paragraphIndex < sectionParagraphs.length; paragraphIndex += 1) {
      const paragraph = sectionParagraphs[paragraphIndex]!;
      const paragraphName = `Paragraph ${idx + paragraphIndex + 1}`;
      chunks.push({
        chunkLevel: 'paragraph',
        headingPath: [title, sectionName, paragraphName],
        content: paragraph,
      });

      const claims = splitClaims(paragraph);
      for (let claimIndex = 0; claimIndex < claims.length; claimIndex += 1) {
        chunks.push({
          chunkLevel: 'claim',
          headingPath: [title, sectionName, paragraphName, `Claim ${claimIndex + 1}`],
          content: claims[claimIndex]!,
        });
      }
    }
  }

  return chunks;
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function seededEmbeddingFromHash(seedHash: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS);
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i += 1) {
    const source = seedHash.charCodeAt(i % seedHash.length);
    const next = seedHash.charCodeAt((i * 7) % seedHash.length);
    vector[i] = ((source + next) % 255) / 255;
  }
  return vector;
}

export async function embedText(text: string, model?: string): Promise<{ embedding: number[]; model: string }> {
  const selectedModel = model ?? DEFAULT_EMBEDDING_MODEL;
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    const seed = await sha256Hex(text);
    return { embedding: seededEmbeddingFromHash(seed), model: `local-fallback:${selectedModel}` };
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: selectedModel,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json() as { data?: Array<{ embedding?: number[] }> };
  const embedding = payload.data?.[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error('Embedding response did not include vector data');
  }

  return { embedding, model: selectedModel };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

export function parseEmbedding(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const parts = trimmed
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .map((item) => Number(item));
      return parts;
    }
  }

  return [];
}

export function withinTemporalWindow(validFrom: string | null, validTo: string | null, nowIso: string): boolean {
  if (validFrom && validFrom > nowIso) return false;
  if (validTo && validTo < nowIso) return false;
  return true;
}

export function hasFilterOverlap(values: string[], filter?: string[]): boolean {
  if (!filter || filter.length === 0) return true;
  if (values.length === 0) return false;
  return values.some((value) => filter.includes(value));
}

export function scoreCandidate(candidate: RetrievalCandidate): number {
  return (
    (0.5 * candidate.similarity_score) +
    (0.25 * (candidate.authority_score / 100)) +
    (0.15 * (candidate.freshness_score / 100)) +
    (0.1 * (candidate.provenance_completeness / 100))
  );
}
