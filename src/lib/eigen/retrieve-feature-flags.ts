/**
 * Eigen retrieve feature flags — pure parsers for env-backed toggles.
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

/** Env: `EIGEN_MULTI_QUERY_FUSION` — multi-query RRF on eigen-retrieve / chat. */
export function readEigenEnableMultiQueryFusion(
  envValue: string | undefined | null = undefined,
): boolean {
  return parseBooleanEnvFlag(envValue, false);
}
