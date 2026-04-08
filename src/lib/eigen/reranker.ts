/**
 * Reranking utilities for the Eigen retrieval pipeline.
 *
 * Supports two strategies:
 * 1. External reranker (Cohere Rerank v4 / similar API)
 * 2. Authority-weighted rescoring (local, no external call)
 *
 * The external reranker is a cross-encoder that jointly scores query-document
 * pairs, delivering 15–40% higher precision than embedding similarity alone.
 */

import type { RetrievalResultItem } from '../oracle/retrieval-contract.js';

export interface RerankOptions {
  /** Maximum results to return after reranking. */
  topN: number;
  /** Minimum relevance score (0–1) to include. */
  minRelevance?: number;
}

/** Result from an external reranker API. */
export interface ExternalRerankResult {
  index: number;
  relevance_score: number;
}

/**
 * Rerank results using an external API (Cohere Rerank, Jina, etc.).
 *
 * The caller provides the rerank function to keep this module API-agnostic.
 */
export async function rerankWithExternal(
  query: string,
  items: RetrievalResultItem[],
  options: RerankOptions,
  rerankFn: (query: string, documents: string[]) => Promise<ExternalRerankResult[]>,
): Promise<RetrievalResultItem[]> {
  if (items.length === 0) return [];

  const documents = items.map((item) => item.excerpt);
  const ranked = await rerankFn(query, documents);

  // Sort by relevance score descending
  ranked.sort((a, b) => b.relevance_score - a.relevance_score);

  const results: RetrievalResultItem[] = [];
  for (const r of ranked) {
    if (results.length >= options.topN) break;
    if (options.minRelevance !== undefined && r.relevance_score < options.minRelevance) continue;
    // Guard against out-of-range or duplicate indices from the external provider
    if (r.index < 0 || r.index >= items.length) continue;

    results.push({
      ...items[r.index],
      relevance: r.relevance_score,
    });
  }

  return results;
}

/**
 * Local authority-weighted reranking.
 *
 * Blends the retrieval score with authority and freshness scores from
 * knowledge chunk metadata. No external API call required.
 *
 * Formula: final = retrieval * retrievalWeight + authority * authorityWeight + freshness * freshnessWeight
 * All weights normalized to sum to 1.
 */
export interface AuthorityRerankWeights {
  /** Weight for the original retrieval score. Default: 0.6. */
  retrieval?: number;
  /** Weight for authority score (0–100 → 0–1). Default: 0.25. */
  authority?: number;
  /** Weight for freshness score (0–100 → 0–1). Default: 0.15. */
  freshness?: number;
}

export function rerankByAuthority(
  items: RetrievalResultItem[],
  options: RerankOptions,
  weights: AuthorityRerankWeights = {},
): RetrievalResultItem[] {
  const w = {
    retrieval: weights.retrieval ?? 0.6,
    authority: weights.authority ?? 0.25,
    freshness: weights.freshness ?? 0.15,
  };

  // Normalize weights
  const total = w.retrieval + w.authority + w.freshness;
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('Authority rerank weights must sum to a positive finite value.');
  }
  w.retrieval /= total;
  w.authority /= total;
  w.freshness /= total;

  const scored = items.map((item) => {
    const authorityScore = ((item.metadata?.authorityScore as number) ?? 50) / 100;
    const freshnessScore = ((item.metadata?.freshnessScore as number) ?? 50) / 100;

    const finalScore =
      item.relevance * w.retrieval +
      authorityScore * w.authority +
      freshnessScore * w.freshness;

    return { ...item, relevance: finalScore };
  });

  scored.sort((a, b) => b.relevance - a.relevance);

  let results = scored.slice(0, options.topN);
  if (options.minRelevance !== undefined) {
    results = results.filter((r) => r.relevance >= options.minRelevance!);
  }

  return results;
}
