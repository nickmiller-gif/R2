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

/** Search the MBA-corpus vector store. Returns [] when unconfigured or on error. */
export async function searchRegentCorpus(
  query: string,
  course?: string | null,
  maxResults = 2,
): Promise<Citation[]> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
  const storeId = Deno.env.get('REGENT_CORPUS_VECTOR_STORE_ID')?.trim();
  if (!apiKey || !storeId || !query.trim()) return [];

  const body: Record<string, unknown> = {
    query: query.slice(0, 1000),
    max_num_results: maxResults,
    rewrite_query: true,
  };
  // Course-scoped retrieval when files were uploaded with a `course` attribute.
  if (course) body.filters = { type: 'eq', key: 'course', value: course };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(`https://api.openai.com/v1/vector_stores/${storeId}/search`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    // An invalid attribute filter (e.g. files lack the attribute) can 400 —
    // retry once without the filter so retrieval still works.
    if (!res.ok && course) {
      delete body.filters;
      res = await fetch(`https://api.openai.com/v1/vector_stores/${storeId}/search`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    if (!res.ok) return [];
    const payload = (await res.json()) as { data?: VectorSearchResult[] };
    const rows = payload.data ?? [];
    return rows
      .map((r): Citation | null => {
        const snippet = (r.content ?? [])
          .filter((c) => c.type === 'text' && c.text)
          .map((c) => c.text!.replace(/\s+/g, ' ').trim())
          .join(' ')
          .slice(0, 280);
        const courseAttr =
          typeof r.attributes?.course === 'string'
            ? (r.attributes!.course as string)
            : course || 'MBA corpus';
        if (!r.filename && !snippet) return null;
        return {
          course: courseAttr,
          source: r.filename ?? undefined,
          kind: 'reading',
          snippet: snippet || undefined,
          retrieved: true,
        };
      })
      .filter((c): c is Citation => !!c);
  } catch {
    return [];
  }
}

/**
 * Enrich the top decisions' citations with retrieved passages. Mutates in place:
 * prepends passage-level citations ahead of the deterministic ones (kept as
 * fallback). Bounded to the first `topN` decisions to cap latency/cost.
 */
export async function enrichCitationsWithCorpus(agenda: RegentDecision[], topN = 3): Promise<void> {
  if (!Deno.env.get('REGENT_CORPUS_VECTOR_STORE_ID')?.trim()) return; // not configured — keep deterministic
  for (const d of agenda.slice(0, topN)) {
    const course = d.citations?.find((c) => c.course)?.course ?? null;
    const passages = await searchRegentCorpus(`${d.framework} ${d.observation}`, course);
    if (passages.length) {
      d.citations = [...passages, ...(d.citations ?? [])];
    }
  }
}
