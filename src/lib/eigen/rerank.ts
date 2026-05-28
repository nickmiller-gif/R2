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
  /**
   * Cancellation signal. `runRerankerWithTimeout` wires this up so that when
   * the timeout fires the port can abort the underlying HTTP request rather
   * than letting it continue consuming edge resources.
   */
  signal?: AbortSignal;
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
 *
 * When the timeout fires we abort the input signal so the port can cancel
 * its underlying HTTP request. The rerank promise is also `.catch`ed inline
 * so that a late rejection arriving after the timeout has won does not
 * surface as an unhandled rejection.
 */
export async function runRerankerWithTimeout(
  port: RerankerPort,
  input: RerankInput,
  timeoutMs: number,
): Promise<RerankOutput | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });

  const rerank = port.rerank({ ...input, signal: controller.signal }).catch(() => null);

  try {
    const result = await Promise.race([rerank, timeout]);
    if (!result) return null;
    if (!Array.isArray(result.scores) || result.scores.length === 0) return null;
    return result;
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

/**
 * Per-request hard limits on what we send to the reranker provider. Both
 * Voyage (`rerank-2`, ~16K tokens/doc) and Cohere (`rerank-english-v3.0`,
 * ~4K tokens/doc) silently truncate or reject oversized inputs; truncating
 * client-side bounds payload size, latency, and per-call cost predictably.
 */
export interface RerankPayloadLimits {
  /** Hard ceiling on query characters before truncation. */
  max_query_chars: number;
  /** Hard ceiling on per-document content characters before truncation. */
  max_document_chars: number;
}

/**
 * Defaults sized comfortably below both provider per-doc token ceilings while
 * leaving room for the 90th-percentile chunk. Override via env in the edge
 * port if a particular corpus needs more headroom.
 */
export const DEFAULT_RERANK_LIMITS: RerankPayloadLimits = {
  max_query_chars: 4_000,
  max_document_chars: 24_000,
};

const MAX_QUERY_CHARS_MIN = 16;
const MAX_QUERY_CHARS_MAX = 32_000;
const MAX_DOCUMENT_CHARS_MIN = 64;
const MAX_DOCUMENT_CHARS_MAX = 200_000;

export function resolveRerankPayloadLimits(
  overrides: Partial<RerankPayloadLimits> | undefined,
  defaults: RerankPayloadLimits = DEFAULT_RERANK_LIMITS,
): RerankPayloadLimits {
  return {
    max_query_chars: clampInt(
      overrides?.max_query_chars,
      defaults.max_query_chars,
      MAX_QUERY_CHARS_MIN,
      MAX_QUERY_CHARS_MAX,
    ),
    max_document_chars: clampInt(
      overrides?.max_document_chars,
      defaults.max_document_chars,
      MAX_DOCUMENT_CHARS_MIN,
      MAX_DOCUMENT_CHARS_MAX,
    ),
  };
}

/**
 * Code-point-safe truncation. JS string slicing splits surrogate pairs, which
 * the JSON encoder happily passes through as lone surrogates — some providers
 * 400 on lone surrogates and the whole rerank call fails open for nothing.
 */
export function truncateForRerank(text: string, maxChars: number): string {
  if (typeof text !== 'string') return '';
  if (maxChars <= 0) return '';
  if (text.length <= maxChars) return text;
  const sliced = text.slice(0, maxChars);
  const lastCode = sliced.charCodeAt(sliced.length - 1);
  // Drop a trailing high surrogate to avoid splitting a surrogate pair.
  if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
    return sliced.slice(0, -1);
  }
  return sliced;
}

/**
 * Apply payload limits and prune empty/whitespace inputs before a provider
 * call. Returns `null` when there is nothing meaningful to rerank — the
 * caller skips the network round-trip entirely and falls back to embedding
 * order without burning quota.
 */
export function prepareRerankRequest(
  input: { query: string; documents: RerankInputDocument[] },
  limits: RerankPayloadLimits = DEFAULT_RERANK_LIMITS,
): { query: string; documents: RerankInputDocument[] } | null {
  const query = truncateForRerank(
    typeof input.query === 'string' ? input.query : '',
    limits.max_query_chars,
  );
  if (query.trim().length === 0) return null;

  const documents: RerankInputDocument[] = [];
  for (const doc of input.documents ?? []) {
    if (!doc || typeof doc.chunk_id !== 'string' || doc.chunk_id.length === 0) continue;
    const content = truncateForRerank(
      typeof doc.content === 'string' ? doc.content : '',
      limits.max_document_chars,
    );
    if (content.trim().length === 0) continue;
    documents.push({ chunk_id: doc.chunk_id, content });
  }

  if (documents.length === 0) return null;
  return { query, documents };
}

/**
 * Map an HTTP status from a reranker provider to a stable, operator-facing
 * kind. The kind shows up in `dropped_context_reasons` on `retrieval_runs`
 * so on-call can triage credential vs throttle vs outage at a glance.
 */
export type RerankerHttpErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'bad_request'
  | 'rate_limited'
  | 'server_error'
  | 'http_error';

export function classifyRerankerHttpStatus(status: number): RerankerHttpErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 500 && status <= 599) return 'server_error';
  if (status >= 400 && status <= 499) return 'bad_request';
  return 'http_error';
}

const ERROR_BODY_CAP_DEFAULT = 256;

/**
 * Builds a bounded, classified Error from a non-OK provider response.
 * `runRerankerWithTimeout` swallows it (fail-open), but the message lands
 * in observability logs — keep it small, no secrets, deterministic shape.
 */
export function formatRerankerError(
  provider: string,
  status: number,
  body: string,
  bodyCap: number = ERROR_BODY_CAP_DEFAULT,
): Error {
  const kind = classifyRerankerHttpStatus(status);
  const cap = Math.max(0, Math.floor(bodyCap));
  const safeBody = typeof body === 'string' ? body.replace(/\s+/g, ' ').slice(0, cap) : '';
  const suffix = safeBody.length > 0 ? `: ${safeBody}` : '';
  return new Error(`reranker_${kind}: provider=${provider} status=${status}${suffix}`);
}
