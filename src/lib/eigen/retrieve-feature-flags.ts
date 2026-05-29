/**
 * Eigen retrieval feature flags — env-backed toggles for chat / retrieve quality.
 */

export function parseBooleanEnvFlag(
  value: string | undefined | null,
  defaultValue = false,
): boolean {
  if (value === undefined || value === null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

export interface EigenRetrievalQualityFlags {
  multiQuery: boolean;
  rerank: boolean;
  topTier: boolean;
}

/**
 * Resolves retrieval quality flags. `EIGEN_TOP_TIER_RETRIEVAL=true` enables both
 * multi-query RRF (E2) and cross-encoder rerank (E1). Individual flags still work.
 */
export function resolveEigenRetrievalQualityFlags(env: {
  topTier?: string | null;
  multiQuery?: string | null;
  rerank?: string | null;
}): EigenRetrievalQualityFlags {
  const topTier = parseBooleanEnvFlag(env.topTier, false);
  const multiQuery = topTier || parseBooleanEnvFlag(env.multiQuery, false);
  const rerank = topTier || parseBooleanEnvFlag(env.rerank, false);
  return { multiQuery, rerank, topTier };
}

export function readEigenEnableMultiQueryFusion(
  envValue: string | undefined | null = undefined,
): boolean {
  return parseBooleanEnvFlag(envValue, false);
}

export function readEigenTopTierRetrieval(
  envValue: string | undefined | null = undefined,
): boolean {
  return parseBooleanEnvFlag(envValue, false);
}

/** Default minimum oracle signal score (0–100) injected into entity-scoped chat. */
export const DEFAULT_ORACLE_SIGNAL_CHAT_MIN_SCORE = 65;

export function readOracleSignalChatMinScore(raw: string | undefined | null): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return DEFAULT_ORACLE_SIGNAL_CHAT_MIN_SCORE;
  return Math.min(100, Math.max(0, n));
}
