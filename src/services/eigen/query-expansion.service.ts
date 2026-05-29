/**
 * Query expansion service — heuristic expansion (Vitest / Node).
 * LLM expansion is edge-only (`eigen-query-expansion.ts`).
 */

import {
  DEFAULT_MAX_EXPANSION_QUERIES,
  expandQueryHeuristically,
  mergeExpansionQueries,
  parseLlmExpansionQueries,
} from '../../lib/eigen/query-expansion.ts';

export interface QueryExpansionService {
  expandHeuristic(query: string, maxQueries?: number): string[];
  parseLlmQueries(raw: string, maxQueries?: number): string[];
  merge(original: string, llmQueries: string[], maxQueries?: number): string[];
}

export function createQueryExpansionService(): QueryExpansionService {
  return {
    expandHeuristic(query, maxQueries = DEFAULT_MAX_EXPANSION_QUERIES) {
      return expandQueryHeuristically(query, maxQueries);
    },
    parseLlmQueries(raw, maxQueries = DEFAULT_MAX_EXPANSION_QUERIES) {
      return parseLlmExpansionQueries(raw, maxQueries);
    },
    merge(original, llmQueries, maxQueries = DEFAULT_MAX_EXPANSION_QUERIES) {
      return mergeExpansionQueries(original, llmQueries, maxQueries);
    },
  };
}
