/**
 * Token and strata budgeting for eigen-retrieve (pure helpers — no Deno APIs).
 * ~4 characters per token is a coarse English-centric estimate suitable for budgeting context windows.
 */

export function estimateChunkTokens(text: string): number {
  if (!text || text.length === 0) return 1;
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Maps hierarchical chunk levels to EigenX KOS strata from the implementation plan. */
const STRATUM_BY_LEVEL: Record<string, string> = {
  document: 'state',
  section: 'doctrine',
  paragraph: 'specs',
  claim: 'evidence',
};

export function chunkLevelToStratum(chunkLevel: string): string {
  return STRATUM_BY_LEVEL[chunkLevel] ?? 'evidence';
}

export function normalizeStrataWeights(
  weights: Record<string, number> | undefined,
): Map<string, number> | null {
  if (!weights || Object.keys(weights).length === 0) return null;
  let sum = 0;
  for (const v of Object.values(weights)) {
    if (typeof v === 'number' && v > 0) sum += v;
  }
  if (sum <= 0) return null;
  const m = new Map<string, number>();
  for (const [k, v] of Object.entries(weights)) {
    if (typeof v === 'number' && v > 0) m.set(k, v / sum);
  }
  return m;
}

function pickStratumBucket(chunkLevel: string, norm: Map<string, number>): string {
  const mapped = chunkLevelToStratum(chunkLevel);
  if (norm.has(mapped)) return mapped;
  let bestKey = [...norm.keys()][0] ?? 'evidence';
  let bestW = -1;
  for (const [k, w] of norm) {
    if (w > bestW) {
      bestW = w;
      bestKey = k;
    }
  }
  return bestKey;
}

export interface SelectableChunk {
  chunk_id: string;
  content: string;
  chunk_level: string;
  composite_score: number;
}

export interface SelectChunksWithinBudgetOptions {
  maxChunks: number;
  maxTokens?: number;
  strataWeights?: Record<string, number>;
}

export interface SelectChunksWithinBudgetResult<T extends SelectableChunk> {
  selected: T[];
  /** Chunks skipped because adding them would exceed max_tokens (after max_chunks satisfied where possible). */
  skippedDueToTokenBudget: number;
}

/**
 * `rankedDescending` must be sorted by composite_score descending.
 * When strata_weights are set, each stratum gets a proportional slice of max_tokens, filled in stratum-priority order,
 * then remaining slots/tokens are filled from the global ranking.
 */
export function selectChunksWithinBudget<T extends SelectableChunk>(
  rankedDescending: T[],
  options: SelectChunksWithinBudgetOptions,
): SelectChunksWithinBudgetResult<T> {
  const maxChunks = Math.max(1, options.maxChunks);
  const tokenBudget =
    options.maxTokens !== undefined && options.maxTokens > 0
      ? options.maxTokens
      : Number.POSITIVE_INFINITY;
  const norm = normalizeStrataWeights(options.strataWeights);

  let skippedDueToTokenBudget = 0;

  if (!norm || norm.size === 0) {
    const selected: T[] = [];
    let totalTokens = 0;
    for (const chunk of rankedDescending) {
      if (selected.length >= maxChunks) break;
      const t = estimateChunkTokens(chunk.content);
      if (totalTokens + t > tokenBudget) {
        skippedDueToTokenBudget++;
        continue;
      }
      selected.push(chunk);
      totalTokens += t;
    }
    return { selected, skippedDueToTokenBudget };
  }

  const buckets = new Map<string, T[]>();
  for (const key of norm.keys()) buckets.set(key, []);

  for (const chunk of rankedDescending) {
    const stratum = pickStratumBucket(chunk.chunk_level, norm);
    buckets.get(stratum)!.push(chunk);
  }

  const stratumCeiling = new Map<string, number>();
  for (const [stratum, weight] of norm) {
    stratumCeiling.set(stratum, Math.floor(tokenBudget * weight));
  }

  const selectedIds = new Set<string>();
  const selected: T[] = [];
  let totalTokens = 0;

  const strataByWeight = [...norm.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);

  for (const stratum of strataByWeight) {
    const pool = buckets.get(stratum) ?? [];
    let stratumTokens = 0;
    const ceiling = stratumCeiling.get(stratum) ?? 0;
    for (const chunk of pool) {
      if (selected.length >= maxChunks) break;
      if (selectedIds.has(chunk.chunk_id)) continue;
      const t = estimateChunkTokens(chunk.content);
      if (stratumTokens + t > ceiling) continue;
      if (totalTokens + t > tokenBudget) continue;
      selectedIds.add(chunk.chunk_id);
      selected.push(chunk);
      stratumTokens += t;
      totalTokens += t;
    }
  }

  for (const chunk of rankedDescending) {
    if (selected.length >= maxChunks) break;
    if (selectedIds.has(chunk.chunk_id)) continue;
    const t = estimateChunkTokens(chunk.content);
    if (totalTokens + t > tokenBudget) {
      skippedDueToTokenBudget++;
      continue;
    }
    selectedIds.add(chunk.chunk_id);
    selected.push(chunk);
    totalTokens += t;
  }

  selected.sort((a, b) => b.composite_score - a.composite_score);

  return { selected, skippedDueToTokenBudget };
}
