/**
 * Eigen corpus retrieval over an OpenAI Vector Store ("your OpenAI vector").
 *
 * Mirrors `regent-corpus-search.ts`. Graceful + advisory: when
 * `EIGEN_CORPUS_VECTOR_STORE_ID` or `OPENAI_API_KEY` is unset, search is skipped
 * and returns `[]`. Read-only — it queries OpenAI and writes nothing.
 *
 * ACCESS CONTROL: this module never widens scope. The single OpenAI Vector
 * Store holds the full (EigenX / private) corpus and has NO row-level
 * governance, so the access boundary is the server-side attribute filter the
 * caller supplies. The calling R2 edge function computes the request's allowed
 * policy-tag scope (public surface → `eigen_public`; EigenX → the principal's
 * granted tags via `resolveEigenxPolicyScope`) and passes it through
 * `buildPolicyScopeFilter`. Never expose the store id / API key to clients.
 *
 * Not wired into retrieval yet — Slice 2 attaches the per-caller filter to the
 * eigen-retrieve / eigen-chat paths.
 */

const OPENAI_VECTOR_STORES = 'https://api.openai.com/v1/vector_stores';
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_RESULTS_CEILING = 50;

/** OpenAI Vector Store attribute filter clause (scalar key/value + and/or). */
export interface OpenAiAttributeFilter {
  type: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'and' | 'or';
  key?: string;
  value?: string | number | boolean;
  filters?: OpenAiAttributeFilter[];
}

export interface EigenCorpusResult {
  fileId?: string;
  filename?: string;
  /** R2 document id, recovered from the `document_id` file attribute. */
  documentId?: string;
  score?: number;
  snippet?: string;
  attributes?: Record<string, unknown> | null;
}

export interface SearchEigenCorpusOptions {
  maxResults?: number;
  /** Per-caller access filter — see `buildPolicyScopeFilter`. */
  filters?: OpenAiAttributeFilter;
  rewriteQuery?: boolean;
  timeoutMs?: number;
}

/**
 * Stable OpenAI attribute key for a policy tag. MUST stay byte-for-byte
 * identical to the uploader (`scripts/eigen-corpus-sync.mjs`) so the search
 * filter matches the attributes stamped at upload time.
 */
export function policyTagAttrKey(tag: string): string {
  const slug = tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `tag_${slug}`;
}

/**
 * Build an attribute filter matching files that carry ANY of the caller's
 * allowed policy tags. Returns `undefined` when no tags are allowed — callers
 * MUST treat that as "deny" (skip the corpus search) rather than querying
 * unfiltered, which would leak the full private store.
 */
export function buildPolicyScopeFilter(allowedTags: string[]): OpenAiAttributeFilter | undefined {
  const keys = Array.from(new Set(allowedTags.map(policyTagAttrKey))).filter((k) => k !== 'tag_');
  if (keys.length === 0) return undefined;
  if (keys.length === 1) return { type: 'eq', key: keys[0], value: true };
  return { type: 'or', filters: keys.map((key) => ({ type: 'eq', key, value: true })) };
}

interface RawSearchResult {
  file_id?: string;
  filename?: string;
  score?: number;
  attributes?: Record<string, unknown> | null;
  content?: Array<{ type?: string; text?: string }>;
}

function toResult(r: RawSearchResult): EigenCorpusResult {
  const snippet = (r.content ?? [])
    .filter((c) => c.type === 'text' && typeof c.text === 'string' && c.text.length > 0)
    .map((c) => (c.text ?? '').replace(/\s+/g, ' ').trim())
    .join(' ')
    .slice(0, 600);
  const documentId =
    typeof r.attributes?.document_id === 'string'
      ? (r.attributes.document_id as string)
      : undefined;
  return {
    fileId: r.file_id,
    filename: r.filename,
    documentId,
    score: typeof r.score === 'number' ? r.score : undefined,
    snippet: snippet.length > 0 ? snippet : undefined,
    attributes: r.attributes ?? null,
  };
}

/**
 * Search the Eigen corpus vector store. Returns `[]` when unconfigured, on
 * timeout, or on any error (advisory — never throws into the caller's path).
 */
export async function searchEigenCorpus(
  query: string,
  opts: SearchEigenCorpusOptions = {},
): Promise<EigenCorpusResult[]> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
  const storeId = Deno.env.get('EIGEN_CORPUS_VECTOR_STORE_ID')?.trim();
  if (!apiKey || !storeId || !query.trim()) return [];

  const body: Record<string, unknown> = {
    query: query.slice(0, 2000),
    max_num_results: Math.max(1, Math.min(opts.maxResults ?? 8, MAX_RESULTS_CEILING)),
    rewrite_query: opts.rewriteQuery ?? true,
  };
  if (opts.filters) body.filters = opts.filters;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${OPENAI_VECTOR_STORES}/${storeId}/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const payload = (await res.json()) as { data?: RawSearchResult[] };
    return (payload.data ?? []).map(toResult);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
