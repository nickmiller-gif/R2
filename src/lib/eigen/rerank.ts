/**
 * Cross-encoder reranking for eigen-retrieve (slice E1 of the next-level roadmap).
 *
 * Stage 2 ranking that runs after embedding/ANN recall + composite scoring.
 * Takes the top-K candidates, asks a cross-encoder for query→document
 * relevance scores, and uses those to reorder the top of the result list.
 *
 * This module is the pure / framework-free half. The concrete provider lives in
 * `supabase/functions/_shared/eigen-reranker.ts` because it needs Edge fetch +
 * env access; this file is what gets unit-tested under Vitest.
 */

export interface RerankInputDocument {
  chunk_id: string;
  content: string;
}

export interface RerankInput {
  query: string;
  documents: RerankInputDocument[];
  /** Caller's preferred top_k; the port may cap it for cost reasons. */
  top_k?: number;
}

export interface RerankScore {
  chunk_id: string;
  rerank_score: number;
}

export interface RerankOutput {
  scores: RerankScore[];
  model: string;
  latency_ms: number;
}

/**
 * Port for a cross-encoder reranking provider. Concrete implementations
 * (Voyage, Cohere, local model) live alongside callers.
 */
export interface RerankerPort {
  rerank(input: RerankInput): Promise<RerankOutput>;
}

export interface RerankConfig {
  /**
   * Maximum candidates to send to the reranker per call. Larger values cost
   * more and add latency; smaller values may miss relevant chunks below the
   * embedding similarity cutoff.
   */
  top_k: number;
  /**
   * Blend factor when fusing rerank_score with the candidate's pre-rerank
   * composite_score. 1.0 = use only rerank_score; 0.0 = ignore rerank.
   */
  blend_weight: number;
  /** Total budget for the reranker call. On timeout we fail open. */
  timeout_ms: number;
}

export const DEFAULT_RERANK_CONFIG: RerankConfig = {
  top_k: 40,
  blend_weight: 0.7,
  timeout_ms: 400,
};

const TOP_K_MIN = 1;
const TOP_K_MAX = 200;
const BLEND_MIN = 0;
const BLEND_MAX = 1;
const TIMEOUT_MIN_MS = 50;
const TIMEOUT_MAX_MS = 5_000;

/**
 * Parses request-level reranking config, layering caller overrides over the
 * defaults. Out-of-range values are clamped, not rejected — the reranker is
 * an optional precision boost, never a hard contract.
 */
export function resolveRerankConfig(
  overrides: Partial<RerankConfig> | undefined,
  defaults: RerankConfig = DEFAULT_RERANK_CONFIG,
): RerankConfig {
  const topK = clampInt(overrides?.top_k, defaults.top_k, TOP_K_MIN, TOP_K_MAX);
  const blendWeight = clampNumber(
    overrides?.blend_weight,
    defaults.blend_weight,
    BLEND_MIN,
    BLEND_MAX,
  );
  const timeoutMs = clampInt(
    overrides?.timeout_ms,
    defaults.timeout_ms,
    TIMEOUT_MIN_MS,
    TIMEOUT_MAX_MS,
  );
  return { top_k: topK, blend_weight: blendWeight, timeout_ms: timeoutMs };
}

export interface RerankableCandidate {
  chunk_id: string;
  content: string;
  composite_score: number;
}

export interface RerankFusionResult<T extends RerankableCandidate> {
  /** Candidates reordered so reranked ones float to the top by fused score. */
  candidates: Array<T & { rerank_score: number | null; fused_score: number }>;
  /** How many candidates were sent to the reranker. */
  reranked_count: number;
  /** How many positions changed vs. the pre-rerank order. */
  reorder_distance: number;
}

/**
 * Applies cross-encoder scores to a candidate list.
 *
 *   1. We sent the top `top_k` candidates by `composite_score` to the
 *      reranker (caller's responsibility).
 *   2. For those candidates we have a `rerank_score` in roughly [0, 1].
 *   3. We compute `fused_score = (1 - w) * composite_score + w * rerank_score`
 *      and re-sort. Candidates without a rerank score keep their
 *      composite_score (no penalty).
 *
 * Pure function. No I/O.
 */
export function fuseRerankScores<T extends RerankableCandidate>(
  candidates: T[],
  scores: RerankScore[],
  blendWeight: number,
): RerankFusionResult<T> {
  const blend = clampNumber(blendWeight, DEFAULT_RERANK_CONFIG.blend_weight, BLEND_MIN, BLEND_MAX);
  const scoreById = new Map<string, number>();
  for (const entry of scores) {
    if (!Number.isFinite(entry.rerank_score)) continue;
    scoreById.set(entry.chunk_id, entry.rerank_score);
  }

  const originalOrder = new Map<string, number>();
  candidates.forEach((candidate, index) => originalOrder.set(candidate.chunk_id, index));

  const fused = candidates.map((candidate) => {
    const rerank = scoreById.get(candidate.chunk_id);
    if (rerank === undefined) {
      return { ...candidate, rerank_score: null, fused_score: candidate.composite_score };
    }
    const fusedScore = (1 - blend) * candidate.composite_score + blend * rerank;
    return { ...candidate, rerank_score: rerank, fused_score: fusedScore };
  });

  fused.sort((a, b) => b.fused_score - a.fused_score);

  let reorderDistance = 0;
  fused.forEach((candidate, newIndex) => {
    const originalIndex = originalOrder.get(candidate.chunk_id);
    if (originalIndex !== undefined) {
      reorderDistance += Math.abs(originalIndex - newIndex);
    }
  });

  return {
    candidates: fused,
    reranked_count: scoreById.size,
    reorder_distance: reorderDistance,
  };
}

/**
 * Selects the candidates that should be sent to the reranker. We always send
 * the top `top_k` by composite_score from the head of the list; candidates
 * past that point are skipped to bound cost.
 */
export function selectRerankBatch<T extends RerankableCandidate>(
  candidates: T[],
  topK: number,
): T[] {
  if (topK <= 0 || candidates.length === 0) return [];
  return candidates.slice(0, Math.min(topK, candidates.length));
}

/**
 * Race a reranker call against a timeout. Returns null on timeout, throw, or
 * empty output — caller treats null as "fail open, keep original order".
 */
export async function runRerankerWithTimeout(
  port: RerankerPort,
  input: RerankInput,
  timeoutMs: number,
): Promise<RerankOutput | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const result = await Promise.race([port.rerank(input), timeout]);
    if (!result) return null;
    if (!Array.isArray(result.scores) || result.scores.length === 0) return null;
    return result;
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}
