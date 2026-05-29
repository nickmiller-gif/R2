import { completeLlmChat } from './llm-chat.ts';
import {
  expandQueryHeuristically,
  mergeExpansionQueries,
  parseLlmExpansionQueries,
} from '../../../src/lib/eigen/query-expansion.ts';
import { parseBooleanEnvFlag } from '../../../src/lib/eigen/retrieve-feature-flags.ts';

export function readMaxExpansionQueries(): number {
  const raw = Deno.env.get('EIGEN_MULTI_QUERY_MAX_QUERIES') ?? '3';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 2) return 3;
  return Math.min(n, 4);
}

export function readMultiQueryUseLlm(): boolean {
  return parseBooleanEnvFlag(Deno.env.get('EIGEN_MULTI_QUERY_LLM'), false);
}

export async function resolveRetrievalQueries(originalQuery: string): Promise<string[]> {
  const max = readMaxExpansionQueries();
  if (!readMultiQueryUseLlm()) {
    return expandQueryHeuristically(originalQuery, max);
  }

  try {
    const result = await completeLlmChat({
      systemPrompt:
        'You generate alternate search queries for document retrieval. Respond with a JSON array of strings only.',
      userContent: [
        `Original question: ${originalQuery}`,
        `Return a JSON array of ${Math.max(1, max - 1)} alternate search queries (short, specific, no duplicates).`,
      ].join('\n'),
      maxTokens: 200,
      temperature: 0.2,
    });
    const llmQueries = parseLlmExpansionQueries(result.text, max);
    return mergeExpansionQueries(originalQuery, llmQueries, max);
  } catch {
    return expandQueryHeuristically(originalQuery, max);
  }
}
