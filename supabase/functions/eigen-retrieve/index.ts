import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import {
  embedText,
  cosineSimilarity,
  hasFilterOverlap,
  parseEmbedding,
  scoreCandidate,
  withinTemporalWindow,
  sha256Hex,
} from '../_shared/eigen.ts';

interface RetrieveRequest {
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

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function parseRequest(body: unknown): RetrieveRequest {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  const roleCheck = await requireRole(auth.claims.userId, 'member');
  if (!roleCheck.ok) return roleCheck.response;

  const startedAt = Date.now();
  const client = getServiceClient();

  let retrievalRunId: string | null = null;

  try {
    const payload = parseRequest(await req.json());
    const maxChunks = Math.max(1, payload.budget_profile?.max_chunks ?? 20);
    const candidateLimit = Math.max(maxChunks * 3, 30);
    const queryHash = await sha256Hex(payload.query);

    const runInsert = await client
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
      .single();

    if (runInsert.error) return errorResponse(runInsert.error.message, 400);
    retrievalRunId = runInsert.data.id as string;

    const { embedding: queryEmbedding } = await embedText(payload.query);

    const chunkQuery = await client
      .from('knowledge_chunks')
      .select(
        'id,document_id,chunk_level,heading_path,entity_ids,policy_tags,valid_from,valid_to,authority_score,freshness_score,provenance_completeness,content,embedding,ingestion_run_id,documents(source_system)',
      )
      .not('embedding', 'is', null)
      .limit(Math.max(candidateLimit * 6, 120));

    if (chunkQuery.error) return errorResponse(chunkQuery.error.message, 400);

    const nowIso = new Date().toISOString();
    const allCandidates = (chunkQuery.data ?? []).map((row) => {
      const entityIds = Array.isArray(row.entity_ids) ? row.entity_ids.map(String) : [];
      const policyTags = Array.isArray(row.policy_tags) ? row.policy_tags.map(String) : [];
      const embedding = parseEmbedding(row.embedding);
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      const sourceSystem = ((row.documents as { source_system?: string } | null)?.source_system ??
        'unknown') as string;

      return {
        chunk_id: row.id as string,
        content: row.content as string,
        chunk_level: row.chunk_level as string,
        heading_path: Array.isArray(row.heading_path) ? row.heading_path.map(String) : [],
        document_id: row.document_id as string,
        ingestion_run_id: (row.ingestion_run_id as string | null) ?? null,
        source_system: sourceSystem,
        entity_ids: entityIds,
        policy_tags: policyTags,
        valid_from: (row.valid_from as string | null) ?? null,
        valid_to: (row.valid_to as string | null) ?? null,
        authority_score: Number(row.authority_score ?? 50),
        freshness_score: Number(row.freshness_score ?? 100),
        provenance_completeness: Number(row.provenance_completeness ?? 0),
        similarity_score: similarity,
      };
    });

    const policyFiltered = allCandidates.filter((candidate) =>
      hasFilterOverlap(candidate.policy_tags, payload.policy_scope),
    );
    const entityFiltered = policyFiltered.filter((candidate) =>
      hasFilterOverlap(candidate.entity_ids, payload.entity_scope),
    );
    const temporalFiltered = entityFiltered.filter((candidate) =>
      withinTemporalWindow(candidate.valid_from, candidate.valid_to, nowIso),
    );

    const runIdSet = Array.from(
      new Set(temporalFiltered.map((candidate) => candidate.ingestion_run_id).filter(Boolean)),
    ) as string[];

    const sourceRefByRunId = new Map<string, string>();
    if (runIdSet.length > 0) {
      const runs = await client
        .from('ingestion_runs')
        .select('id,source_ref')
        .in('id', runIdSet);
      if (runs.error) return errorResponse(runs.error.message, 400);
      for (const run of runs.data ?? []) {
        sourceRefByRunId.set(run.id as string, (run.source_ref as string) ?? 'unknown');
      }
    }

    const reranked = temporalFiltered
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
      .sort((left, right) => right.composite_score - left.composite_score)
      .slice(0, maxChunks);

    const droppedReasons: string[] = [];
    if (allCandidates.length > policyFiltered.length) {
      droppedReasons.push(`policy_filtered: ${allCandidates.length - policyFiltered.length} chunks`);
    }
    if (policyFiltered.length > entityFiltered.length) {
      droppedReasons.push(`entity_filtered: ${policyFiltered.length - entityFiltered.length} chunks`);
    }
    if (entityFiltered.length > temporalFiltered.length) {
      droppedReasons.push(
        `temporal_filtered: ${entityFiltered.length - temporalFiltered.length} chunks`,
      );
    }

    const elapsed = Date.now() - startedAt;
    const runComplete = await client
      .from('retrieval_runs')
      .update({
        candidate_count: allCandidates.length,
        filtered_count: temporalFiltered.length,
        final_count: reranked.length,
        dropped_context_reasons: droppedReasons,
        latency_ms: elapsed,
        status: 'completed',
      })
      .eq('id', retrievalRunId);
    if (runComplete.error) return errorResponse(runComplete.error.message, 400);

    return jsonResponse({
      retrieval_run_id: retrievalRunId,
      chunks: reranked.map((candidate) => ({
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
      })),
      dropped_context_reasons: droppedReasons,
      latency_ms: elapsed,
    });
  } catch (err) {
    if (retrievalRunId) {
      await client
        .from('retrieval_runs')
        .update({
          status: 'failed',
          latency_ms: Date.now() - startedAt,
          metadata: {
            failure_reason: err instanceof Error ? err.message : 'Unknown error',
          },
        })
        .eq('id', retrievalRunId);
    }

    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
