/**
 * Shared retrieval pipeline for eigen-retrieve (HTTP) and eigen-chat (in-process).
 * Avoids an extra edge round-trip when chat calls retrieve.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { embedText, scoreCandidate, sha256Hex } from './eigen.ts';
import { selectChunksWithinBudget } from './retrieval-budget.ts';

export interface EigenRetrieveRequest {
  query: string;
  entity_scope?: string[];
  policy_scope?: string[];
  budget_profile?: {
    max_chunks?: number;
    max_tokens?: number;
    strata_weights?: Record<string, number>;
  };
  rerank?: boolean;
  include_provenance?: boolean;
}

export interface EigenRetrieveChunk {
  chunk_id: string;
  content: string;
  chunk_level: string;
  similarity_score: number;
  authority_score: number;
  freshness_score: number;
  composite_score: number;
  provenance?: {
    document_id: string;
    source_system: string;
    source_ref: string;
    heading_path: string[];
    valid_from: string | null;
  };
}

export interface EigenRetrieveResultBody {
  retrieval_run_id: string;
  chunks: EigenRetrieveChunk[];
  dropped_context_reasons: string[];
  latency_ms: number;
}

interface MatchChunkRow {
  id: string;
  document_id: string;
  chunk_level: string;
  heading_path: unknown;
  entity_ids: unknown;
  policy_tags: unknown;
  valid_from: string | null;
  valid_to: string | null;
  authority_score: number;
  freshness_score: number;
  provenance_completeness: number;
  content: string;
  ingestion_run_id: string | null;
  source_system: string;
  similarity: number;
}

interface MatchKnowledgeChunksPayload {
  ann_row_count: number;
  passed_row_count: number;
  chunks: MatchChunkRow[];
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

export function parseEigenRetrieveRequest(body: unknown): EigenRetrieveRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object');
  }

  const payload = body as Record<string, unknown>;
  if (typeof payload.query !== 'string' || payload.query.trim().length === 0) {
    throw new Error('query is required');
  }

  return {
    query: payload.query.trim(),
    entity_scope: normalizeList(payload.entity_scope),
    policy_scope: normalizeList(payload.policy_scope),
    budget_profile:
      payload.budget_profile && typeof payload.budget_profile === 'object'
        ? {
            max_chunks:
              typeof (payload.budget_profile as Record<string, unknown>).max_chunks === 'number'
                ? (payload.budget_profile as Record<string, number>).max_chunks
                : undefined,
            max_tokens:
              typeof (payload.budget_profile as Record<string, unknown>).max_tokens === 'number'
                ? (payload.budget_profile as Record<string, number>).max_tokens
                : undefined,
            strata_weights:
              typeof (payload.budget_profile as Record<string, unknown>).strata_weights ===
              'object'
                ? ((payload.budget_profile as Record<string, unknown>).strata_weights as Record<
                    string,
                    number
                  >)
                : undefined,
          }
        : undefined,
    rerank: payload.rerank !== false,
    include_provenance: payload.include_provenance !== false,
  };
}

function parseMatchPayload(raw: unknown): MatchKnowledgeChunksPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error('match_knowledge_chunks returned invalid payload');
  }
  const o = raw as Record<string, unknown>;
  const chunks = Array.isArray(o.chunks) ? o.chunks : [];
  return {
    ann_row_count: typeof o.ann_row_count === 'number' ? o.ann_row_count : 0,
    passed_row_count: typeof o.passed_row_count === 'number' ? o.passed_row_count : 0,
    chunks: chunks as MatchChunkRow[],
  };
}

export type EigenRetrieveExecutionResult =
  | { ok: true; body: EigenRetrieveResultBody }
  | { ok: false; status: number; message: string };

export async function executeEigenRetrieve(
  client: SupabaseClient,
  payload: EigenRetrieveRequest,
): Promise<EigenRetrieveExecutionResult> {
  const startedAt = Date.now();
  let retrievalRunId: string | null = null;

  const failRun = async (reason: string) => {
    if (!retrievalRunId) return;
    await client
      .from('retrieval_runs')
      .update({
        status: 'failed',
        latency_ms: Date.now() - startedAt,
        metadata: { failure_reason: reason },
      })
      .eq('id', retrievalRunId);
  };

  try {
    const maxChunks = Math.max(1, payload.budget_profile?.max_chunks ?? 20);
    const annLimit = Math.min(Math.max(maxChunks * 8, 100), 500);
    const queryHash = await sha256Hex(payload.query);
    const nowIso = new Date().toISOString();

    const [runOutcome, embedOutcome] = await Promise.allSettled([
      client
        .from('retrieval_runs')
        .insert([
          {
            query_hash: queryHash,
            decomposition: {
              query: payload.query,
              entity_scope: payload.entity_scope ?? [],
              policy_scope: payload.policy_scope ?? [],
            },
            budget_profile: payload.budget_profile ?? {},
            status: 'running',
          },
        ])
        .select('id')
        .single(),
      embedText(payload.query),
    ]);

    if (runOutcome.status === 'rejected') {
      return { ok: false, status: 500, message: String(runOutcome.reason) };
    }

    const runInsert = runOutcome.value;
    if (runInsert.error) {
      return { ok: false, status: 400, message: runInsert.error.message };
    }

    retrievalRunId = runInsert.data.id as string;

    if (embedOutcome.status === 'rejected') {
      const reason =
        embedOutcome.reason instanceof Error
          ? embedOutcome.reason.message
          : String(embedOutcome.reason);
      await failRun(reason);
      return { ok: false, status: 500, message: reason };
    }

    const { embedding: queryEmbedding } = embedOutcome.value;

    const rpcResult = await client.rpc('match_knowledge_chunks', {
      query_embedding: queryEmbedding,
      ann_limit: annLimit,
      filter_entity_ids: payload.entity_scope?.length ? payload.entity_scope : null,
      filter_policy_tags: payload.policy_scope?.length ? payload.policy_scope : null,
      valid_at: nowIso,
    });

    if (rpcResult.error) {
      await failRun(rpcResult.error.message);
      return { ok: false, status: 400, message: rpcResult.error.message };
    }

    const envelope = parseMatchPayload(rpcResult.data);
    const droppedReasons: string[] = [
      `ann_index_probe: ${envelope.ann_row_count} rows (limit ${annLimit})`,
    ];
    const hardDropped = envelope.ann_row_count - envelope.passed_row_count;
    if (hardDropped > 0) {
      droppedReasons.push(`hard_filter_dropped: ${hardDropped} chunks (entity/policy on ANN pool)`);
    }

    const temporalFiltered = envelope.chunks.map((row) => {
      const entityIds = Array.isArray(row.entity_ids) ? row.entity_ids.map(String) : [];
      const policyTags = Array.isArray(row.policy_tags) ? row.policy_tags.map(String) : [];
      return {
        chunk_id: row.id,
        content: row.content,
        chunk_level: row.chunk_level,
        heading_path: Array.isArray(row.heading_path) ? row.heading_path.map(String) : [],
        document_id: row.document_id,
        ingestion_run_id: row.ingestion_run_id,
        source_system: row.source_system ?? 'unknown',
        entity_ids: entityIds,
        policy_tags: policyTags,
        valid_from: row.valid_from,
        valid_to: row.valid_to,
        authority_score: Number(row.authority_score ?? 50),
        freshness_score: Number(row.freshness_score ?? 100),
        provenance_completeness: Number(row.provenance_completeness ?? 0),
        similarity_score: Number(row.similarity ?? 0),
      };
    });

    const runIdSet = Array.from(
      new Set(temporalFiltered.map((c) => c.ingestion_run_id).filter(Boolean)),
    ) as string[];

    const sourceRefByRunId = new Map<string, string>();
    if (runIdSet.length > 0) {
      const runs = await client.from('ingestion_runs').select('id,source_ref').in('id', runIdSet);
      if (runs.error) {
        await failRun(runs.error.message);
        return { ok: false, status: 400, message: runs.error.message };
      }
      for (const run of runs.data ?? []) {
        sourceRefByRunId.set(run.id as string, (run.source_ref as string) ?? 'unknown');
      }
    }

    const scoredDescending = temporalFiltered
      .map((candidate) => ({
        ...candidate,
        composite_score: payload.rerank === false
          ? candidate.similarity_score
          : scoreCandidate({
              id: candidate.chunk_id,
              content: candidate.content,
              chunk_level: candidate.chunk_level as 'document' | 'section' | 'paragraph' | 'claim',
              heading_path: candidate.heading_path,
              document_id: candidate.document_id,
              source_system: candidate.source_system,
              source_ref: sourceRefByRunId.get(candidate.ingestion_run_id ?? '') ?? 'unknown',
              valid_from: candidate.valid_from,
              valid_to: candidate.valid_to,
              entity_ids: candidate.entity_ids,
              policy_tags: candidate.policy_tags,
              similarity_score: candidate.similarity_score,
              authority_score: candidate.authority_score,
              freshness_score: candidate.freshness_score,
              provenance_completeness: candidate.provenance_completeness,
            }),
      }))
      .sort((left, right) => right.composite_score - left.composite_score);

    const { selected: reranked, skippedDueToTokenBudget } = selectChunksWithinBudget(
      scoredDescending,
      {
        maxChunks,
        maxTokens: payload.budget_profile?.max_tokens,
        strataWeights: payload.budget_profile?.strata_weights,
      },
    );

    if (skippedDueToTokenBudget > 0) {
      droppedReasons.push(`token_budget_skipped: ${skippedDueToTokenBudget} chunks`);
    }

    const elapsed = Date.now() - startedAt;
    const runComplete = await client
      .from('retrieval_runs')
      .update({
        candidate_count: envelope.ann_row_count,
        filtered_count: envelope.passed_row_count,
        final_count: reranked.length,
        dropped_context_reasons: droppedReasons,
        latency_ms: elapsed,
        status: 'completed',
      })
      .eq('id', retrievalRunId);

    if (runComplete.error) {
      await failRun(runComplete.error.message);
      return { ok: false, status: 400, message: runComplete.error.message };
    }

    const chunks: EigenRetrieveChunk[] = reranked.map((candidate) => ({
      chunk_id: candidate.chunk_id,
      content: candidate.content,
      chunk_level: candidate.chunk_level,
      similarity_score: Number(candidate.similarity_score.toFixed(6)),
      authority_score: candidate.authority_score,
      freshness_score: candidate.freshness_score,
      composite_score: Number(candidate.composite_score.toFixed(6)),
      provenance: payload.include_provenance === false
        ? undefined
        : {
            document_id: candidate.document_id,
            source_system: candidate.source_system,
            source_ref: sourceRefByRunId.get(candidate.ingestion_run_id ?? '') ?? 'unknown',
            heading_path: candidate.heading_path,
            valid_from: candidate.valid_from,
          },
    }));

    return {
      ok: true,
      body: {
        retrieval_run_id: retrievalRunId,
        chunks,
        dropped_context_reasons: droppedReasons,
        latency_ms: elapsed,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await failRun(message);
    return { ok: false, status: 500, message };
  }
}
