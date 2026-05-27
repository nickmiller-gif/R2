/**
 * Concrete reranker port for the Supabase Edge runtime.
 *
 * Default provider is Voyage AI (`rerank-2`); Cohere (`rerank-english-v3.0`)
 * is the only other supported option. If no API key is configured for the
 * selected provider, `createEdgeReranker()` returns `null` and callers fall
 * back to the embedding-only ranking — the reranker is precision-only and
 * never a hard dependency.
 */
import type {
  RerankerPort,
  RerankInput,
  RerankOutput,
  RerankScore,
} from '../../../src/lib/eigen/rerank.ts';

type Provider = 'voyage' | 'cohere';

interface ResolvedConfig {
  provider: Provider;
  apiKey: string;
  model: string;
  endpoint: string;
}

const VOYAGE_DEFAULT_MODEL = 'rerank-2';
const COHERE_DEFAULT_MODEL = 'rerank-english-v3.0';

/**
 * Resolves provider config from environment. Returns null when no API key is
 * available for the selected provider — callers MUST treat this as
 * "reranker disabled".
 */
export function resolveEdgeRerankerConfig(): ResolvedConfig | null {
  const providerRaw = (Deno.env.get('EIGEN_RERANKER_PROVIDER') ?? 'voyage').toLowerCase().trim();
  const provider: Provider = providerRaw === 'cohere' ? 'cohere' : 'voyage';

  if (provider === 'voyage') {
    const apiKey = Deno.env.get('VOYAGE_API_KEY') ?? Deno.env.get('EIGEN_RERANKER_API_KEY');
    if (!apiKey) return null;
    return {
      provider,
      apiKey,
      model: Deno.env.get('EIGEN_RERANKER_MODEL') ?? VOYAGE_DEFAULT_MODEL,
      endpoint: Deno.env.get('VOYAGE_RERANK_URL') ?? 'https://api.voyageai.com/v1/rerank',
    };
  }

  const apiKey = Deno.env.get('COHERE_API_KEY') ?? Deno.env.get('EIGEN_RERANKER_API_KEY');
  if (!apiKey) return null;
  return {
    provider,
    apiKey,
    model: Deno.env.get('EIGEN_RERANKER_MODEL') ?? COHERE_DEFAULT_MODEL,
    endpoint: Deno.env.get('COHERE_RERANK_URL') ?? 'https://api.cohere.com/v2/rerank',
  };
}

/**
 * Factory. Returns `null` when no provider is configured — caller stays on
 * the embedding-only path. Errors during a single rerank call are caught by
 * `runRerankerWithTimeout` in the pure module; this factory only fails when
 * no provider can be initialised at all.
 */
export function createEdgeReranker(
  config: ResolvedConfig | null = resolveEdgeRerankerConfig(),
): RerankerPort | null {
  if (!config) return null;

  return {
    rerank: async (input: RerankInput): Promise<RerankOutput> => {
      const startedAt = Date.now();
      const scores =
        config.provider === 'voyage'
          ? await callVoyageRerank(config, input)
          : await callCohereRerank(config, input);

      return {
        scores,
        model: `${config.provider}:${config.model}`,
        latency_ms: Date.now() - startedAt,
      };
    },
  };
}

async function callVoyageRerank(
  config: ResolvedConfig,
  input: RerankInput,
): Promise<RerankScore[]> {
  const documents = input.documents.map((doc) => doc.content);
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: input.query,
      documents,
      model: config.model,
      top_k: input.top_k ?? documents.length,
    }),
    signal: input.signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`voyage rerank failed: ${response.status} ${text}`);
  }
  const body = (await response.json()) as {
    data?: Array<{ index?: number; relevance_score?: number }>;
  };
  return mapIndexedScores(input.documents, body.data);
}

async function callCohereRerank(
  config: ResolvedConfig,
  input: RerankInput,
): Promise<RerankScore[]> {
  const documents = input.documents.map((doc) => doc.content);
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: input.query,
      documents,
      model: config.model,
      top_n: input.top_k ?? documents.length,
    }),
    signal: input.signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`cohere rerank failed: ${response.status} ${text}`);
  }
  const body = (await response.json()) as {
    results?: Array<{ index?: number; relevance_score?: number }>;
  };
  return mapIndexedScores(input.documents, body.results);
}

function mapIndexedScores(
  documents: RerankInput['documents'],
  rows: Array<{ index?: number; relevance_score?: number }> | undefined,
): RerankScore[] {
  if (!Array.isArray(rows)) return [];
  const out: RerankScore[] = [];
  for (const row of rows) {
    if (typeof row.index !== 'number' || !Number.isFinite(row.index)) continue;
    if (row.index < 0 || row.index >= documents.length) continue;
    if (typeof row.relevance_score !== 'number' || !Number.isFinite(row.relevance_score)) continue;
    const doc = documents[row.index];
    if (!doc) continue;
    out.push({ chunk_id: doc.chunk_id, rerank_score: row.relevance_score });
  }
  return out;
}
