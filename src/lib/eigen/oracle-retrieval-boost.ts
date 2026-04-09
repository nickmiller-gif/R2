/**
 * Pure helpers for ranking retrieved chunks that carry Oracle linkage.
 * Used by eigen-retrieve-core (edge) and unit-tested in Vitest.
 */

export function parseOracleRetrievalBoostCap(raw: string | undefined, fallback = 0.1): number {
  const parsed = Number.parseFloat(raw ?? '');
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(parsed, 0.25));
}

/**
 * Extra headroom on composite retrieval score when a chunk is tied to an Oracle signal.
 * `cap` is the maximum boost when oracle_relevance_score is 100 (see parseOracleRetrievalBoostCap).
 */
export function oracleCompositeBoost(
  signalId: string | null | undefined,
  relevanceScore: number | null | undefined,
  cap: number,
): number {
  if (!signalId) return 0;
  if (relevanceScore != null && Number.isFinite(relevanceScore)) {
    const n = Math.max(0, Math.min(100, relevanceScore));
    return (n / 100) * cap;
  }
  return cap * 0.35;
}
