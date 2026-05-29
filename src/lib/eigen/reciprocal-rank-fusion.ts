/**
 * Reciprocal Rank Fusion (RRF) for multi-query retrieval (slice E2).
 * Pure — safe for Vitest and edge imports.
 */

export const DEFAULT_RRF_K = 60;

export interface RrfRankedItem {
  id: string;
}

/**
 * Computes RRF scores: sum over lists of 1 / (k + rank), rank is 1-based.
 */
export function computeRrfScores(
  rankedLists: ReadonlyArray<ReadonlyArray<RrfRankedItem>>,
  k = DEFAULT_RRF_K,
): Map<string, number> {
  const scores = new Map<string, number>();
  const safeK = Number.isFinite(k) && k >= 1 ? k : DEFAULT_RRF_K;

  for (const list of rankedLists) {
    for (let index = 0; index < list.length; index++) {
      const id = list[index]?.id?.trim();
      if (!id) continue;
      const increment = 1 / (safeK + index + 1);
      scores.set(id, (scores.get(id) ?? 0) + increment);
    }
  }

  return scores;
}

export function sortIdsByRrfScore(scores: Map<string, number>): string[] {
  return [...scores.entries()].sort((left, right) => right[1] - left[1]).map(([id]) => id);
}
