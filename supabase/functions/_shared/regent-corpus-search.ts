/**
 * REGENT corpus retrieval — semantic search over the CMU MBA corpus, hosted in
 * an OpenAI Vector Store ("R2 MBA Corpus"). Upgrades citations from filename-
 * level to passage-level: given a decision's framework + observation (and the
 * course the framework names), it returns the most relevant readings.
 *
 * Graceful + advisory: if REGENT_CORPUS_VECTOR_STORE_ID or OPENAI_API_KEY is
 * unset, search is skipped and the deterministic course-level citations stand.
 * Read-only — it queries OpenAI, writes nothing.
 */

import type { Citation, RegentDecision } from '../../../packages/r2-regent/src/review.ts';

interface VectorSearchResult {
  filename?: string;
  score?: number;
  attributes?: Record<string, unknown> | null;
  content?: Array<{ type?: string; text?: string }>;
}

/** Minimum similarity to accept a passage as a citation (drops weak matches). */
const MIN_SCORE = 0.25;
const SEARCH_TIMEOUT_MS = 8000;

/**
 * Course attribute values were uploaded from folder names, which use "and"
 * (e.g. "Financial and Managerial Accounting I") while framework display names
 * use "&". Normalize so the eq filter actually matches.
 */
function normalizeCourseForFilter(course: string): string {
  return course.replace(/\s*&\s*/g, ' and ');
}

async function postSearch(
  storeId: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<VectorSearchResult[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.openai.com/v1/vector_stores/${storeId}/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { data?: VectorSearchResult[] };
    return payload.data ?? [];
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Search the MBA-corpus vector store. Returns [] when unconfigured or on error. */
export async function searchRegentCorpus(
  query: string,
  course?: string | null,
  maxResults = 2,
): Promise<Citation[]> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
  const storeId = Deno.env.get('REGENT_CORPUS_VECTOR_STORE_ID')?.trim();
  if (!apiKey || !storeId || !query.trim()) return [];

  const base: Record<string, unknown> = {
    query: query.slice(0, 1000),
    max_num_results: Math.max(maxResults, 4), // over-fetch, then threshold + dedupe
    rewrite_query: true,
  };

  // 1) course-scoped (normalized); 2) fall back to unfiltered when the filter
  // matches nothing or errors — so a course-attribute mismatch never silently
  // drops retrieval to the deterministic index.
  let rows: VectorSearchResult[] | null = null;
  if (course) {
    rows = await postSearch(storeId, apiKey, {
      ...base,
      filters: { type: 'eq', key: 'course', value: normalizeCourseForFilter(course) },
    });
  }
  if (!rows || rows.length === 0) {
    rows = await postSearch(storeId, apiKey, base);
  }
  if (!rows) return [];

  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const r of rows) {
    if (typeof r.score === 'number' && r.score < MIN_SCORE) continue;
    const file = r.filename ?? '';
    if (file && seen.has(file)) continue;
    if (file) seen.add(file);
    const snippet = (r.content ?? [])
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text!.replace(/\s+/g, ' ').trim())
      .join(' ')
      .slice(0, 280);
    const courseAttr =
      typeof r.attributes?.course === 'string'
        ? (r.attributes!.course as string)
        : course || 'MBA corpus';
    if (!file && !snippet) continue;
    out.push({
      course: courseAttr,
      source: r.filename ?? undefined,
      kind: 'reading',
      snippet: snippet || undefined,
      retrieved: true,
    });
    if (out.length >= maxResults) break;
  }
  return out;
}

/**
 * Enrich the top decisions' citations with retrieved passages. Mutates in place:
 * prepends passage-level citations ahead of the deterministic ones (kept as
 * fallback). Bounded to the first `topN` decisions; searches run in parallel to
 * cap added latency.
 */
export async function enrichCitationsWithCorpus(agenda: RegentDecision[], topN = 3): Promise<void> {
  if (!Deno.env.get('REGENT_CORPUS_VECTOR_STORE_ID')?.trim()) return; // not configured — keep deterministic
  const targets = agenda.slice(0, topN);
  await Promise.all(
    targets.map(async (d) => {
      const course = d.citations?.find((c) => c.course)?.course ?? null;
      const passages = await searchRegentCorpus(`${d.framework} ${d.observation}`, course);
      if (passages.length) d.citations = [...passages, ...(d.citations ?? [])];
    }),
  );
}
