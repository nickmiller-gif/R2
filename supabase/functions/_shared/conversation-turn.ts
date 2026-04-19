import type { EigenRetrieveChunk } from './eigen-retrieve-core.ts';
import type { getServiceClient } from './supabase.ts';

export const CONVERSATION_TURN_TELEMETRY_OWNERSHIP = {
  write_path_owner: 'R2 Platform',
  sink: 'supabase.public.conversation_turn',
  calibration_consumer: 'OWSR Stage 7',
} as const;

export interface RetrievalPlan {
  tool: 'eigen-retrieve';
  policy_scope: string[];
  retrieval_run_id: string;
  chunk_count: number;
  chunk_ids: string[];
  rank_preview: Array<{
    rank: number;
    chunk_id: string;
    score: number;
    source_system: string;
  }>;
}

export function buildRetrievalPlan(
  policyScope: string[],
  chunks: EigenRetrieveChunk[],
  retrievalRunId: string,
): RetrievalPlan {
  return {
    tool: 'eigen-retrieve',
    policy_scope: policyScope,
    retrieval_run_id: retrievalRunId,
    chunk_count: chunks.length,
    chunk_ids: chunks.map((chunk) => chunk.chunk_id),
    rank_preview: chunks.slice(0, 5).map((chunk, index) => ({
      rank: index + 1,
      chunk_id: chunk.chunk_id,
      score: Number(chunk.composite_score?.toFixed(4) ?? chunk.similarity_score?.toFixed(4) ?? 0),
      source_system: chunk.provenance?.source_system ?? 'unknown',
    })),
  };
}

export async function insertConversationTurn(
  client: ReturnType<typeof getServiceClient>,
  params: {
    siteId: string | null;
    mode: 'public' | 'eigenx';
    userId: string | null;
    question: string;
    answer: string;
    retrievalRunId: string;
    effectivePolicyScope: string[];
    citations: unknown[];
    confidence: unknown;
    retrievalPlan: RetrievalPlan;
    latencyMs: number;
    idempotencyKey: string | null;
  },
) {
  if (params.idempotencyKey) {
    let existingQuery = client
      .from('conversation_turn')
      .select('id')
      .eq('mode', params.mode)
      .eq('idempotency_key', params.idempotencyKey);
    existingQuery = params.siteId === null ? existingQuery.is('site_id', null) : existingQuery.eq('site_id', params.siteId);
    existingQuery = params.userId === null ? existingQuery.is('user_id', null) : existingQuery.eq('user_id', params.userId);
    const { data: existing } = await existingQuery.maybeSingle();
    if (existing && (existing as { id?: string }).id) {
      return (existing as { id: string }).id;
    }
  }

  const payload = {
    site_id: params.siteId,
    mode: params.mode,
    user_id: params.userId,
    question: params.question,
    answer: params.answer,
    retrieval_run_id: params.retrievalRunId,
    effective_policy_scope: params.effectivePolicyScope,
    citations: params.citations,
    confidence: params.confidence,
    retrieval_plan: params.retrievalPlan,
    latency_ms: params.latencyMs,
    idempotency_key: params.idempotencyKey,
  };
  const { data, error } = await client
    .from('conversation_turn')
    .insert(payload)
    .select('id')
    .single();
  if (error) {
    if ((error as { code?: string }).code === '23505' && params.idempotencyKey) {
      let existingQuery = client
        .from('conversation_turn')
        .select('id')
        .eq('mode', params.mode)
        .eq('idempotency_key', params.idempotencyKey);
      existingQuery = params.siteId === null ? existingQuery.is('site_id', null) : existingQuery.eq('site_id', params.siteId);
      existingQuery = params.userId === null ? existingQuery.is('user_id', null) : existingQuery.eq('user_id', params.userId);
      const { data: existing } = await existingQuery.maybeSingle();
      if (existing && (existing as { id?: string }).id) {
        return (existing as { id: string }).id;
      }
    }
    console.warn('conversation_turn insert failed', error.message);
    return null;
  }
  return (data as { id: string }).id;
}
