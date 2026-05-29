/**
 * Query expansion for multi-query RAG (slice E2) — heuristic + JSON parse helpers.
 */

export const DEFAULT_MAX_EXPANSION_QUERIES = 3;
const MIN_EXPANSION_QUERY_LENGTH = 3;

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'what',
  'who',
  'where',
  'when',
  'why',
  'how',
  'do',
  'does',
  'did',
  'can',
  'could',
  'should',
  'would',
  'about',
  'for',
  'with',
  'from',
  'into',
  'and',
  'or',
  'to',
  'of',
  'in',
  'on',
  'at',
  'it',
  'this',
  'that',
  'these',
  'those',
  'me',
  'my',
  'our',
  'your',
  'their',
]);

function normalizeQueryKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function pushUnique(out: string[], seen: Set<string>, raw: string): void {
  const trimmed = raw.trim();
  if (trimmed.length < MIN_EXPANSION_QUERY_LENGTH) return;
  const key = normalizeQueryKey(trimmed);
  if (seen.has(key)) return;
  seen.add(key);
  out.push(trimmed);
}

/**
 * Cheap expansions without an LLM — original query plus focused reformulations.
 */
export function expandQueryHeuristically(
  query: string,
  maxQueries = DEFAULT_MAX_EXPANSION_QUERIES,
): string[] {
  const base = query.trim();
  if (!base) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  pushUnique(out, seen, base);

  const withoutQuestion = base
    .replace(
      /^(what|who|where|when|why|how)\s+(is|are|was|were|do|does|did|can|could|should|would)\s+/i,
      '',
    )
    .replace(/\?+$/g, '')
    .trim();
  pushUnique(out, seen, withoutQuestion);

  if (base.length > 36) {
    const keywords = base
      .replace(/[^\w\s'-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word.toLowerCase()));
    if (keywords.length >= 2) {
      pushUnique(out, seen, keywords.slice(0, 8).join(' '));
    }
  } else if (base.length >= MIN_EXPANSION_QUERY_LENGTH) {
    pushUnique(out, seen, `details about ${base}`);
  }

  return out.slice(0, Math.max(1, Math.min(maxQueries, 8)));
}

/**
 * Parses LLM JSON array output; returns only valid non-empty strings.
 */
export function parseLlmExpansionQueries(
  raw: string,
  maxQueries = DEFAULT_MAX_EXPANSION_QUERIES,
): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  let parsed: unknown;
  try {
    const jsonStart = trimmed.indexOf('[');
    const jsonEnd = trimmed.lastIndexOf(']');
    if (jsonStart < 0 || jsonEnd <= jsonStart) return [];
    parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    if (typeof item !== 'string') continue;
    pushUnique(out, seen, item);
    if (out.length >= maxQueries) break;
  }
  return out;
}

/**
 * Merges original query with LLM suggestions and heuristic fallbacks.
 */
export function mergeExpansionQueries(
  original: string,
  llmQueries: string[],
  maxQueries = DEFAULT_MAX_EXPANSION_QUERIES,
): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  pushUnique(merged, seen, original);
  for (const q of llmQueries) pushUnique(merged, seen, q);
  if (merged.length === 1) {
    for (const q of expandQueryHeuristically(original, maxQueries)) {
      pushUnique(merged, seen, q);
    }
  }
  return merged.slice(0, Math.max(1, Math.min(maxQueries, 8)));
}
