/**
 * Eigen chat — multi-store OpenAI corpus retrieval (slice 2b-corpus).
 * Advisory + opt-in via EIGEN_VECTOR_STORE_RETRIEVAL=true.
 */
import { searchEigenCorpusMulti } from './eigen-corpus-search.ts';
import { eigenCorpusStoreIds } from './eigen-corpus-stores.ts';
import type { EigenRetrieveChunk } from './eigen-retrieve-core.ts';
import {
  isOpenAiVectorRetrievalEnabled,
  mergePromptRetrievalChunks,
  openAiCorpusHitsToPromptChunks,
  type OpenAiCorpusHitForConversion,
} from '../../../src/lib/eigen/openai-corpus-retrieval.ts';

export function openAiVectorRetrievalEnabled(): boolean {
  return isOpenAiVectorRetrievalEnabled(Deno.env.get('EIGEN_VECTOR_STORE_RETRIEVAL'));
}

const DEFAULT_SCORE = 0.55;

function promptChunksToEigenChunks(
  chunks: ReturnType<typeof openAiCorpusHitsToPromptChunks>,
): EigenRetrieveChunk[] {
  return chunks.map((chunk, index) => ({
    chunk_id: `openai:${chunk.provenance?.document_id ?? 'corpus'}:${index}`,
    content: chunk.content,
    chunk_level: 'paragraph',
    similarity_score: chunk.similarity_score ?? DEFAULT_SCORE,
    authority_score: 0.55,
    freshness_score: 0.55,
    composite_score: chunk.composite_score ?? chunk.similarity_score ?? DEFAULT_SCORE,
    provenance: {
      document_id: chunk.provenance?.document_id ?? `openai-corpus-${index}`,
      source_system: chunk.provenance?.source_system ?? 'openai_vector_store',
      source_ref: chunk.provenance?.source_ref ?? 'OpenAI corpus',
      heading_path: chunk.provenance?.heading_path ?? [],
      valid_from: chunk.provenance?.valid_from ?? null,
    },
  }));
}

export async function fetchOpenAiCorpusChunksForChat(
  message: string,
  maxResults = 6,
): Promise<EigenRetrieveChunk[]> {
  if (!openAiVectorRetrievalEnabled()) return [];
  const storeIds = eigenCorpusStoreIds();
  if (storeIds.length === 0) return [];
  const hits = await searchEigenCorpusMulti(message, {
    storeIds,
    maxResults,
    timeoutMs: 8000,
  });
  return promptChunksToEigenChunks(
    openAiCorpusHitsToPromptChunks(hits as OpenAiCorpusHitForConversion[]),
  );
}

export function mergeRetrievalChunksForChat(
  primary: EigenRetrieveChunk[],
  openAi: EigenRetrieveChunk[],
): EigenRetrieveChunk[] {
  return mergePromptRetrievalChunks(primary, openAi);
}
