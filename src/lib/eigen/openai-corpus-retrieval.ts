/**
 * OpenAI Vector Store corpus hits → Eigen chat retrieval chunk shape.
 * Deno-free so Vitest and edge functions share conversion logic.
 */

import type { ChatRetrievalChunkForPrompt } from './chat-retrieval-context.ts';

export function isOpenAiVectorRetrievalEnabled(envValue: string | undefined): boolean {
  return envValue?.trim() === 'true';
}

export interface OpenAiCorpusHitForConversion {
  fileId?: string;
  filename?: string;
  documentId?: string;
  score?: number;
  snippet?: string;
  attributes?: Record<string, unknown> | null;
}

const DEFAULT_OPENAI_SCORE = 0.55;

function readAttributeString(
  attributes: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const value = attributes?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Maps advisory OpenAI corpus hits into prompt/citation chunks. Skips empty snippets.
 * Scores are clamped to [0, 1] for confidence helpers.
 */
export function openAiCorpusHitsToPromptChunks(
  hits: OpenAiCorpusHitForConversion[],
): ChatRetrievalChunkForPrompt[] {
  const out: ChatRetrievalChunkForPrompt[] = [];
  for (const [index, hit] of hits.entries()) {
    const content = (hit.snippet ?? '').replace(/\s+/g, ' ').trim();
    if (!content) continue;
    const rawScore =
      typeof hit.score === 'number' && Number.isFinite(hit.score)
        ? hit.score
        : DEFAULT_OPENAI_SCORE;
    const score = Math.min(1, Math.max(0, rawScore));
    const documentId = hit.documentId ?? hit.fileId ?? `openai-corpus-${index}`;
    const sourceSystem =
      readAttributeString(hit.attributes, 'source_system') ?? 'openai_vector_store';
    const sourceRef = hit.filename?.trim() || documentId;
    out.push({
      content,
      composite_score: score,
      similarity_score: score,
      provenance: {
        document_id: documentId,
        source_system: sourceSystem,
        source_ref: sourceRef,
        heading_path: [],
        valid_from: null,
      },
    });
  }
  return out;
}

/** Primary pgvector chunks first; OpenAI corpus hits append as additive context. */
export function mergePromptRetrievalChunks<T extends ChatRetrievalChunkForPrompt>(
  primary: T[],
  openAi: ChatRetrievalChunkForPrompt[],
): T[] {
  if (openAi.length === 0) return primary;
  return [...primary, ...(openAi as T[])];
}
