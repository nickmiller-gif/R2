/**
 * EigenX Vector Search — types for the hybrid_search SQL function.
 */

import type { ChunkLevel } from './knowledge-chunk.js';

/** Parameters passed to the hybrid_search RPC. */
export interface HybridSearchParams {
  queryText: string;
  queryEmbedding: number[];
  matchCount: number;
  filterOwnerId: string | null;
  fullTextWeight: number;
  semanticWeight: number;
  rrfK: number;
}

/** Single row returned by the hybrid_search SQL function. */
export interface HybridSearchRow {
  id: string;
  content: string;
  chunk_level: string;
  authority_score: number;
  freshness_score: number;
  document_id: string;
  heading_path: string[];
  entity_ids: string[];
  score: number;
}

/** Typed result after mapping from DB row. */
export interface VectorSearchResult {
  id: string;
  content: string;
  chunkLevel: ChunkLevel;
  authorityScore: number;
  freshnessScore: number;
  documentId: string;
  headingPath: string[];
  entityIds: string[];
  score: number;
}
