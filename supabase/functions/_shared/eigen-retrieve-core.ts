/**
 * Shared retrieval pipeline for eigen-retrieve (HTTP) and eigen-chat (in-process).
 * Avoids an extra edge round-trip when chat calls retrieve.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { embedText, scoreCandidate, sha256Hex } from './eigen.ts';
import { selectChunksWithinBudget } from './retrieval-budget.ts';
import {
  oracleCompositeBoost as computeOracleCompositeBoost,
  parseOracleRetrievalBoostCap,
} from '../../../src/lib/eigen/oracle-retrieval-boost.ts';
import {
  applySiteRelevanceGate,
  limitCrossSourceRatio,
} from './source-relevance-gating.ts';

export interface EigenRetrieveRequest {
  query: string;
  entity_scope?: string[];
  policy_scope?: string[];
  site_id?: string;
  site_source_systems?: string[];
  site_boost?: number;
  global_penalty?: number;
  site_relevance_min?: number;
  cross_source_max_ratio?: number;
  allow_cross_source_when_low_confidence?: boolean;
  outside_domain_intent?: boolean;
  disallowed_source_systems?: string[];
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
  /** Set when this chunk is linked to an Oracle signal (ingest / outbox pipeline). */
  oracle_signal_id?: string | null;
  oracle_relevance_score?: number | null;
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
  oracle_signal_id?: string | null;
  oracle_relevance_score?: number | null;
  source_system: string;
  similarity: number;
}

interface MatchKnowledgeChunksPayload {
  ann_row_count: number;
  passed_row_count: number;
  chunks: MatchChunkRow[];
}

interface SiteRegistryContext {
  source_systems: string[];
  default_policy_scope: string[];
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  if (!Number.isFinite(value)) return undefined;
  return value;
}

// Env reads are cached at module scope: env variables are stable per deployment
// and reading them on every request is unnecessary overhead.
let _defaultSiteBoost: number | undefined;
let _defaultGlobalPenalty: number | undefined;
let _oracleBoostCap: number | undefined;
let _uploadSourceBoost: number | undefined;

function readDefaultSiteBoost(): number {
  if (_defaultSiteBoost === undefined) {
    const raw = Deno.env.get('EIGEN_SITE_SOURCE_BOOST') ?? '0.08';
    const parsed = Number.parseFloat(raw);
    _defaultSiteBoost = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 0.8)) : 0.08;
  }
  return _defaultSiteBoost;
}

function readDefaultGlobalPenalty(): number {
  if (_defaultGlobalPenalty === undefined) {
    const raw = Deno.env.get('EIGEN_GLOBAL_SOURCE_PENALTY') ?? '0.0';
    const parsed = Number.parseFloat(raw);
    _defaultGlobalPenalty = Number.isFinite(parsed) ? Math.max(-0.8, Math.min(parsed, 0.8)) : 0;
  }
  return _defaultGlobalPenalty;
}

function readOracleRelevanceBoostCap(): number {
  if (_oracleBoostCap === undefined) {
    _oracleBoostCap = parseOracleRetrievalBoostCap(Deno.env.get('EIGEN_ORACLE_RETRIEVAL_BOOST_CAP'));
  }
  return _oracleBoostCap;
}

function readUploadSourceBoost(): number {
  if (_uploadSourceBoost === undefined) {
    const raw = Deno.env.get('EIGEN_UPLOAD_SOURCE_BOOST') ?? '0.12';
    const parsed = Number.parseFloat(raw);
    _uploadSourceBoost = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 0.5)) : 0.12;
  }
  return _uploadSourceBoost;
}

async function loadSiteRegistryContext(
  client: SupabaseClient,
  siteId: string | undefined,
): Promise<SiteRegistryContext | null> {
  if (!siteId || siteId.trim().length === 0) return null;
  const q = await client
    .from('eigen_site_registry')
    .select('source_systems,default_policy_scope,status')
    .eq('site_id', siteId)
    .maybeSingle();
  if (q.error || !q.data) return null;
  const status = String((q.data as Record<string, unknown>).status ?? 'active');
  if (status !== 'active') return null;
  const row = q.data as Record<string, unknown>;
  return {
    source_systems: normalizeList(row.source_systems),
    default_policy_scope: normalizeList(row.default_policy_scope),
  };
}

export function parseEigenRetrieveRequest(body: unknown): EigenRetrieveRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object');
  }

  const payload = body as Record<string, unknown>;
  if (typeof payload.query !== 'string' || payload.query.trim().length === 0) {
    throw new Error('query is required');
  }

  const entityScope = normalizeList(payload.entity_scope);
  const policyScope = normalizeList(payload.policy_scope);
  if (entityScope && entityScope.length > 100) {
    throw new Error('entity_scope must not exceed 100 entries');
  }
  if (policyScope && policyScope.length > 100) {
    throw new Error('policy_scope must not exceed 100 entries');
  }

  return {
    query: payload.query.trim(),
    entity_scope: entityScope,
    policy_scope: policyScope,
    site_id: typeof payload.site_id === 'string' ? payload.site_id.trim() : undefined,
    site_source_systems: normalizeList(payload.site_source_systems),
    site_boost: parseNumber(payload.site_boost),
    global_penalty: parseNumber(payload.global_penalty),
    site_relevance_min: parseNumber(payload.site_relevance_min),
    cross_source_max_ratio: parseNumber(payload.cross_source_max_ratio),
    allow_cross_source_when_low_confidence: payload.allow_cross_source_when_low_confidence === true,
    outside_domain_intent: payload.outside_domain_intent === true,
    disallowed_source_systems: normalizeList(payload.disallowed_source_systems),
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
    const siteRegistry = await loadSiteRegistryContext(client, payload.site_id);
    const effectiveSiteSources = (payload.site_source_systems && payload.site_source_systems.length > 0)
      ? payload.site_source_systems
      : (siteRegistry?.source_systems ?? []);
    const effectivePolicyScope = (payload.policy_scope && payload.policy_scope.length > 0)
      ? payload.policy_scope
      : (siteRegistry?.default_policy_scope ?? []);

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
              policy_scope: effectivePolicyScope ?? [],
              site_id: payload.site_id ?? null,
              site_source_systems: effectiveSiteSources ?? [],
              site_relevance_min: payload.site_relevance_min ?? null,
              cross_source_max_ratio: payload.cross_source_max_ratio ?? null,
              allow_cross_source_when_low_confidence: payload.allow_cross_source_when_low_confidence ?? false,
              outside_domain_intent: payload.outside_domain_intent ?? false,
              disallowed_source_systems: payload.disallowed_source_systems ?? [],
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
      filter_policy_tags: effectivePolicyScope.length ? effectivePolicyScope : null,
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
      const oracleSignalId =
        typeof row.oracle_signal_id === 'string' && row.oracle_signal_id.length > 0
          ? row.oracle_signal_id
          : null;
      const oracleRel =
        typeof row.oracle_relevance_score === 'number' && Number.isFinite(row.oracle_relevance_score)
          ? row.oracle_relevance_score
          : null;
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
        oracle_signal_id: oracleSignalId,
        oracle_relevance_score: oracleRel,
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

    const siteSources = new Set(
      effectiveSiteSources.map((s) => s.trim()).filter((s) => s.length > 0),
    );
    const siteBoost = payload.site_boost ?? readDefaultSiteBoost();
    const globalPenalty = payload.global_penalty ?? readDefaultGlobalPenalty();
    if (siteSources.size > 0) {
      droppedReasons.push(
        `site_priority: boost=${siteBoost.toFixed(3)} penalty=${globalPenalty.toFixed(3)} site_sources=${siteSources.size}`,
      );
    }

    const relevanceGate = applySiteRelevanceGate(temporalFiltered, {
      siteSources,
      siteRelevanceMin: payload.site_relevance_min,
      allowCrossSourceWhenLowConfidence: payload.allow_cross_source_when_low_confidence,
      outsideDomainIntent: payload.outside_domain_intent,
    });
    if (siteSources.size > 0) {
      droppedReasons.push(
        `site_relevance_gate: site=${relevanceGate.siteCandidateCount} cross=${relevanceGate.crossCandidateCount} best_site_similarity=${relevanceGate.bestSiteSimilarity.toFixed(4)}`,
      );
    }
    if (relevanceGate.crossSuppressedCount > 0) {
      droppedReasons.push(`cross_source_suppressed: ${relevanceGate.crossSuppressedCount} chunks`);
    }
    if (relevanceGate.crossSourceFallbackEnabled) {
      droppedReasons.push('cross_source_fallback_enabled');
    }

    const disallowedSourceSystems = new Set(
      (payload.disallowed_source_systems ?? []).map((value) => value.trim()).filter((value) => value.length > 0),
    );
    const filteredByDisallowed = disallowedSourceSystems.size > 0
      ? relevanceGate.candidates.filter((candidate) => !disallowedSourceSystems.has(candidate.source_system))
      : relevanceGate.candidates;
    if (disallowedSourceSystems.size > 0) {
      const disallowedDroppedCount = relevanceGate.candidates.length - filteredByDisallowed.length;
      if (disallowedDroppedCount > 0) {
        droppedReasons.push(`disallowed_source_system_dropped: ${disallowedDroppedCount} chunks`);
      }
    }

    // rerank defaults to true; only skipped when caller explicitly passes rerank: false
    const applyRerank = payload.rerank !== false;
    const hasSiteSources = siteSources.size > 0;
    const oracleBoostCap = readOracleRelevanceBoostCap();
    const uploadSourceBoost = readUploadSourceBoost();

    const scoredDescending = filteredByDisallowed
      .map((candidate) => {
        const baseScore = applyRerank
          ? scoreCandidate({
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
            })
          : candidate.similarity_score;
        const siteAdj = hasSiteSources
          ? (siteSources.has(candidate.source_system) ? siteBoost : globalPenalty)
          : 0;
        const oracleAdj = computeOracleCompositeBoost(
          candidate.oracle_signal_id,
          candidate.oracle_relevance_score,
          oracleBoostCap,
        );
        const sourceLower = candidate.source_system.toLowerCase();
        const uploadAdj =
          sourceLower.includes('upload') || sourceLower.includes('manual') || sourceLower.includes('autonomous')
            ? uploadSourceBoost
            : 0;
        return {
          ...candidate,
          composite_score: Number(
            Math.max(0, Math.min(1.5, baseScore + siteAdj + oracleAdj + uploadAdj)).toFixed(6),
          ),
        };
      })
      .sort((left, right) => right.composite_score - left.composite_score);

    const ratioLimited = limitCrossSourceRatio(scoredDescending, {
      siteSources,
      crossSourceMaxRatio: payload.cross_source_max_ratio,
      maxChunks,
    });
    if (ratioLimited.droppedCrossSourceCount > 0) {
      droppedReasons.push(`cross_source_ratio_dropped: ${ratioLimited.droppedCrossSourceCount} chunks`);
    }

    const { selected: reranked, skippedDueToTokenBudget } = selectChunksWithinBudget(ratioLimited.candidates, {
      maxChunks,
      maxTokens: payload.budget_profile?.max_tokens,
      strataWeights: payload.budget_profile?.strata_weights,
    });

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
      oracle_signal_id: candidate.oracle_signal_id,
      oracle_relevance_score: candidate.oracle_relevance_score,
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
