/**
 * Vector Search Service — hybrid semantic + full-text search over knowledge chunks.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 * Bridges the Oracle retrieval contract with the hybrid_search SQL function.
 */

import type {
  RetrievalQuery,
  RetrievalResult,
  RetrievalResultItem,
} from '../../lib/oracle/retrieval-contract.js';
import { filterByRelevance } from '../../lib/oracle/retrieval-contract.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import type { HybridSearchParams, HybridSearchRow, VectorSearchResult } from '../../types/eigen/vector-search.js';
import type { ChunkLevel } from '../../types/eigen/knowledge-chunk.js';

export interface VectorSearchService {
  search(query: RetrievalQuery, embedding: number[], ownerId: string): Promise<RetrievalResult>;
}

export interface VectorSearchDb {
  hybridSearch(params: HybridSearchParams): Promise<HybridSearchRow[]>;
}

function rowToResult(row: HybridSearchRow): VectorSearchResult {
  return {
    id: row.id,
    content: row.content,
    chunkLevel: row.chunk_level as ChunkLevel,
    authorityScore: row.authority_score,
    freshnessScore: row.freshness_score,
    documentId: row.document_id,
    headingPath: row.heading_path,
    entityIds: row.entity_ids,
    score: row.score,
  };
}

function resultToItem(result: VectorSearchResult): RetrievalResultItem {
  return {
    id: result.id,
    relevance: result.score,
    sourceLane: 'internal_canonical',
    excerpt: result.content,
    metadata: {
      chunkLevel: result.chunkLevel,
      authorityScore: result.authorityScore,
      freshnessScore: result.freshnessScore,
      documentId: result.documentId,
      headingPath: result.headingPath,
      entityIds: result.entityIds,
    },
  };
}

/** Resolve retrieval mode to weight pair. */
function modeToWeights(mode: RetrievalQuery['mode']): { fullTextWeight: number; semanticWeight: number } {
  switch (mode) {
    case 'keyword':
      return { fullTextWeight: 1.0, semanticWeight: 0.0 };
    case 'semantic':
      return { fullTextWeight: 0.0, semanticWeight: 1.0 };
    case 'hybrid':
    default:
      return { fullTextWeight: 1.0, semanticWeight: 1.0 };
  }
}

export function createVectorSearchService(db: VectorSearchDb): VectorSearchService {
  return {
    async search(query, embedding, ownerId) {
      const { fullTextWeight, semanticWeight } = modeToWeights(query.mode);

      const rows = await db.hybridSearch({
        queryText: query.query,
        queryEmbedding: embedding,
        matchCount: query.topK,
        filterOwnerId: ownerId,
        fullTextWeight,
        semanticWeight,
        rrfK: 50,
      });

      const results = rows.map(rowToResult);
      let items = results.map(resultToItem);

      if (query.minRelevance !== undefined) {
        items = filterByRelevance(items, query.minRelevance);
      }

      return {
        query,
        items,
        retrievedAt: nowUtc().toISOString(),
        producerRef: 'eigen/hybrid-search-v1',
      };
    },
  };
}
