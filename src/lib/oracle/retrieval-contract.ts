/**
 * Oracle retrieval contract — types and helpers for retrieval queries.
 *
 * Defines the standard contract shapes used by Oracle when constructing and
 * routing retrieval requests to the Eigen/EigenX retrieval pipeline. Pure
 * types and lightweight constructors. No DB access.
 *
 * Maps to `retrievalContract` in the legacy shared/oracle layer.
 */

import type { OracleSourceLane } from '../../types/oracle/shared.ts';

export type RetrievalMode = 'semantic' | 'keyword' | 'hybrid';

export type RetrievalIntent =
  | 'thesis_validation'
  | 'evidence_enrichment'
  | 'gap_filling'
  | 'contradiction_check'
  | 'opportunity_discovery';

export interface RetrievalQuery {
  /** Natural-language query text. */
  query: string;
  intent: RetrievalIntent;
  mode: RetrievalMode;
  /** Maximum number of results to return. */
  topK: number;
  /** Restrict retrieval to specific source lanes. */
  sourceLanes?: OracleSourceLane[];
  /** Optional thesis ID this retrieval is scoped to. */
  thesisId?: string;
  /** Optional signal ID this retrieval is scoped to. */
  signalId?: string;
  /** Minimum relevance score (0–1) to include in results. */
  minRelevance?: number;
}

export interface RetrievalResultItem {
  /** Unique identifier of the retrieved item (e.g. document ID). */
  id: string;
  /** Relevance score returned by the retrieval engine (0–1). */
  relevance: number;
  sourceLane: OracleSourceLane;
  /** Short excerpt or summary from the retrieved content. */
  excerpt: string;
  metadata: Record<string, unknown>;
}

export interface RetrievalResult {
  query: RetrievalQuery;
  items: RetrievalResultItem[];
  /** ISO timestamp when retrieval was performed. */
  retrievedAt: string;
  /** Which model/pipeline produced this result. */
  producerRef: string;
}

/**
 * Build a retrieval query with sensible defaults applied.
 */
export function makeRetrievalQuery(
  partial: Pick<RetrievalQuery, 'query' | 'intent'> & Partial<RetrievalQuery>,
): RetrievalQuery {
  return {
    mode: 'hybrid',
    topK: 10,
    minRelevance: 0.5,
    ...partial,
  };
}

/**
 * Filter retrieval results by minimum relevance threshold.
 */
export function filterByRelevance(
  items: RetrievalResultItem[],
  minRelevance: number,
): RetrievalResultItem[] {
  return items.filter((r) => r.relevance >= minRelevance);
}
