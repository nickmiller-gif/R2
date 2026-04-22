/**
 * Oracle White Space Pipeline — 6-stage run engine.
 *
 * Orchestrates: create → gather evidence → resolve entities →
 * generate hypotheses → score & verify → publish/review.
 *
 * Uses new tables: oracle_whitespace_runs, oracle_run_evidence,
 * oracle_run_hypotheses, entity_mentions, entity_relations,
 * verification_results, oracle_calibration_log.
 *
 * POST   ?action=create     — Create a new White Space Run (queued)
 * POST   ?action=execute    — Execute a queued/failed run through the pipeline
 * POST   ?action=publish    — Publish selected hypotheses from a completed run
 * POST   ?action=outcome    — Record an outcome against a thesis
 * GET    ?id=<run_id>       — Retrieve run with hypotheses, evidence, evaluation
 * GET    (no id)            — List recent runs
 */

import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey, validateBody } from '../_shared/validate.ts';

// ─── Types ───────────────────────────────────────────────────────────

interface CreateRunRequest {
  domain: string;
  targetEntities: string[];
  constraints: Record<string, unknown>;
  evidenceSourcesAllowed: string[];
  timeHorizon?: string;
  riskLevel: 'low' | 'medium' | 'high';
  runLabel?: string;
}

interface ExecuteRunRequest {
  runId: string;
}

interface PublishRequest {
  runId: string;
  hypothesisIds: string[];
  publicationNotes: string;
}

interface OutcomeRequest {
  thesisId: string;
  verdict: 'confirmed' | 'partially_confirmed' | 'refuted' | 'inconclusive';
  summary: string;
  evidenceRefs: Record<string, unknown>[];
  observedAt: string;
}

// ─── Pipeline stage helpers ──────────────────────────────────────────

const AUTHORITY_SCORES: Record<string, number> = {
  registry_direct: 95,
  curated_database: 85,
  domain_export: 70,
  web_search: 50,
  llm_generation: 30,
};

const COMPOSITE_WEIGHTS = {
  novelty: 0.30,
  evidence: 0.30,
  confidence: 0.25,
  actionability: 0.15,
};

function computeComposite(scores: {
  novelty: number;
  evidence: number;
  confidence: number;
  actionability: number;
}): number {
  return (
    scores.novelty * COMPOSITE_WEIGHTS.novelty +
    scores.evidence * COMPOSITE_WEIGHTS.evidence +
    scores.confidence * COMPOSITE_WEIGHTS.confidence +
    scores.actionability * COMPOSITE_WEIGHTS.actionability
  );
}

async function updateRunStatus(
  serviceClient: ReturnType<typeof getServiceClient>,
  runId: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    ...extra,
  };
  const { error } = await serviceClient
    .from('oracle_whitespace_runs')
    .update(patch)
    .eq('id', runId);
  if (error) throw new Error(`Failed to update run status: ${error.message}`);
}

// ─── Stage 1: Create Run ─────────────────────────────────────────────

async function createRun(
  serviceClient: ReturnType<typeof getServiceClient>,
  userId: string,
  input: CreateRunRequest,
) {
  const { data, error } = await serviceClient
    .from('oracle_whitespace_runs')
    .insert([{
      domain: input.domain,
      target_entities: input.targetEntities,
      constraints: input.constraints,
      evidence_sources_allowed: input.evidenceSourcesAllowed,
      time_horizon: input.timeHorizon ?? null,
      risk_level: input.riskLevel,
      run_label: input.runLabel ?? `${input.domain} run`,
      status: 'queued',
      created_by: userId,
    }])
    .select()
    .single();

  if (error) throw new Error(`Failed to create run: ${error.message}`);
  return data;
}

// ─── Stage 2: Gather Evidence ────────────────────────────────────────

async function gatherEvidence(
  serviceClient: ReturnType<typeof getServiceClient>,
  run: Record<string, unknown>,
) {
  const runId = run.id as string;
  const targetEntities = (run.target_entities ?? []) as string[];
  const domain = run.domain as string;
  const sourcesAllowed = (run.evidence_sources_allowed ?? []) as string[];

  await updateRunStatus(serviceClient, runId, 'gathering_evidence');

  // Tier 1: Semantic retrieval from knowledge_chunks
  const evidenceRows: Record<string, unknown>[] = [];
  const chunkSourceAllowed = sourcesAllowed.length === 0
    || sourcesAllowed.includes('knowledge_chunks')
    || sourcesAllowed.includes('curated_database');
  const searchTerms = [domain, ...targetEntities]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(' & ');

  let chunks: Record<string, unknown>[] | null = null;
  if (chunkSourceAllowed && searchTerms) {
    const { data, error: chunkErr } = await serviceClient
      .from('knowledge_chunks')
      .select('id, content, authority_score, policy_tags, document_id')
      .textSearch('content', searchTerms, { type: 'websearch' })
      .limit(50);
    if (chunkErr) throw new Error(`Failed to gather chunk evidence: ${chunkErr.message}`);
    chunks = data;
  }

  if (chunks) {
    for (const chunk of chunks) {
      evidenceRows.push({
        run_id: runId,
        chunk_id: chunk.id,
        source_type: 'curated_database',
        source_ref: `knowledge_chunks:${chunk.id}`,
        source_system: 'knowledge_chunks',
        ingest_run: {
          id: runId,
          source_system: 'oracle-ws-pipeline',
          started_at: new Date().toISOString(),
          trigger: 'pipeline_execute',
        },
        evidence_tier: 'curated_database',
        sources_queried: ['knowledge_chunks'],
        adversarial_pass: false,
        registry_verified_ratio: null,
        authority_score: chunk.authority_score ?? AUTHORITY_SCORES.curated_database,
        relevance_score: 0.7, // base relevance; refine with vector similarity later
        content_excerpt: typeof chunk.content === 'string'
          ? chunk.content.substring(0, 500)
          : null,
        provenance_chain: JSON.stringify([{
          source: 'knowledge_chunks',
          document_id: chunk.document_id,
          retrieved_at: new Date().toISOString(),
        }]),
      });
    }
  }

  // Tier 2: Structured data from Oracle signals related to target entities
  if (targetEntities.length > 0) {
    const { data: signals, error: sigErr } = await serviceClient
      .from('oracle_signals')
      .select('id, entity_asset_id, score, confidence_band, reasons, tags')
      .in('entity_asset_id', targetEntities)
      .limit(30);

    if (!sigErr && signals) {
      for (const signal of signals) {
        evidenceRows.push({
          run_id: runId,
          chunk_id: null,
          source_type: 'curated_database',
          source_ref: `oracle_signals:${signal.id}`,
          source_system: 'oracle_signals',
          ingest_run: {
            id: runId,
            source_system: 'oracle-ws-pipeline',
            started_at: new Date().toISOString(),
            trigger: 'pipeline_execute',
          },
          evidence_tier: 'curated_database',
          sources_queried: ['oracle_signals'],
          adversarial_pass: false,
          registry_verified_ratio: null,
          authority_score: AUTHORITY_SCORES.curated_database,
          relevance_score: (signal.score ?? 50) / 100,
          content_excerpt: Array.isArray(signal.reasons)
            ? signal.reasons.join('; ').substring(0, 500)
            : null,
          provenance_chain: JSON.stringify([{
            source: 'oracle_signals',
            signal_id: signal.id,
            retrieved_at: new Date().toISOString(),
          }]),
        });
      }
    }
  }

  // Tier 3: Existing theses for context
  const { data: theses, error: thErr } = await serviceClient
    .from('oracle_theses')
    .select('id, title, thesis_statement, confidence, evidence_strength')
    .eq('publication_state', 'published')
    .limit(20);

  if (!thErr && theses) {
    for (const thesis of theses) {
      evidenceRows.push({
        run_id: runId,
        chunk_id: null,
        source_type: 'curated_database',
        source_ref: `oracle_theses:${thesis.id}`,
        source_system: 'oracle_theses',
        ingest_run: {
          id: runId,
          source_system: 'oracle-ws-pipeline',
          started_at: new Date().toISOString(),
          trigger: 'pipeline_execute',
        },
        evidence_tier: 'curated_database',
        sources_queried: ['oracle_theses'],
        adversarial_pass: false,
        registry_verified_ratio: null,
        authority_score: AUTHORITY_SCORES.curated_database,
        relevance_score: (thesis.confidence ?? 50) / 100,
        content_excerpt: `${thesis.title}: ${thesis.thesis_statement}`.substring(0, 500),
        provenance_chain: JSON.stringify([{
          source: 'oracle_theses',
          thesis_id: thesis.id,
          retrieved_at: new Date().toISOString(),
        }]),
      });
    }
  }

  // Batch insert evidence
  if (evidenceRows.length > 0) {
    const { error: insertErr } = await serviceClient
      .from('oracle_run_evidence')
      .insert(evidenceRows);
    if (insertErr) throw new Error(`Failed to insert evidence: ${insertErr.message}`);
  }

  return evidenceRows.length;
}

// ─── Stage 3: Resolve Entities ───────────────────────────────────────

async function resolveEntities(
  serviceClient: ReturnType<typeof getServiceClient>,
  runId: string,
) {
  await updateRunStatus(serviceClient, runId, 'resolving_entities');

  // Fetch evidence gathered for this run
  const { data: evidence } = await serviceClient
    .from('oracle_run_evidence')
    .select('id, chunk_id, content_excerpt')
    .eq('run_id', runId)
    .not('chunk_id', 'is', null);

  if (!evidence || evidence.length === 0) {
    return {
      uniqueEntities: 0,
      mentionLinks: 0,
      chunkCount: 0,
      unresolvedChunkCount: 0,
    };
  }

  // Look up existing entity_mentions for these chunks
  const chunkIds = evidence.map((e: Record<string, unknown>) => e.chunk_id).filter(Boolean);

  const { data: existingMentions } = await serviceClient
    .from('entity_mentions')
    .select('chunk_id, entity_id')
    .in('chunk_id', chunkIds);

  // Count unique entities found
  const entitySet = new Set(
    (existingMentions ?? []).map((m: Record<string, unknown>) => m.entity_id as string),
  );
  const resolvedChunks = new Set(
    (existingMentions ?? []).map((m: Record<string, unknown>) => String(m.chunk_id ?? '')),
  );

  return {
    uniqueEntities: entitySet.size,
    mentionLinks: (existingMentions ?? []).length,
    chunkCount: chunkIds.length,
    unresolvedChunkCount: Math.max(0, chunkIds.length - resolvedChunks.size),
  };
}

// ─── Stage 4: Generate Hypotheses ────────────────────────────────────

async function generateHypotheses(
  serviceClient: ReturnType<typeof getServiceClient>,
  runId: string,
  domain: string,
  riskLevel: string,
) {
  await updateRunStatus(serviceClient, runId, 'generating_hypotheses');

  // Fetch run evidence for hypothesis generation
  const { data: evidence } = await serviceClient
    .from('oracle_run_evidence')
    .select('id, source_ref, source_system, authority_score, relevance_score, content_excerpt')
    .eq('run_id', runId)
    .order('authority_score', { ascending: false })
    .limit(40);

  if (!evidence || evidence.length === 0) return [];

  // Build evidence summaries for hypothesis generation
  const evidenceSummaries = evidence
    .filter((e: Record<string, unknown>) => e.content_excerpt)
    .map((e: Record<string, unknown>) => ({
      id: e.id as string,
      source: e.source_system as string,
      authority: e.authority_score as number,
      excerpt: e.content_excerpt as string,
    }));

  // Generate hypotheses from evidence patterns
  // In production, this calls an LLM; for now, we create structured
  // hypothesis shells from evidence clusters that the operator can refine.
  const hypotheses: Record<string, unknown>[] = [];

  // Group evidence by source system to identify cross-source patterns
  const bySource: Record<string, typeof evidenceSummaries> = {};
  for (const e of evidenceSummaries) {
    const key = e.source;
    if (!bySource[key]) bySource[key] = [];
    bySource[key]!.push(e);
  }

  const sourceCount = Object.keys(bySource).length;

  // Create a hypothesis for each major evidence cluster
  let hypothesisIdx = 0;
  for (const [source, items] of Object.entries(bySource)) {
    if (items.length === 0) continue;

    const citationIds = items.map((i) => i.id);
    const avgAuthority = items.reduce((s, i) => s + i.authority, 0) / items.length;

    // Compute scoring dimensions
    const evidenceStrength = Math.min(avgAuthority / 100, 1);
    const confidence = Math.min(items.length / 10, 1) * (sourceCount > 1 ? 0.9 : 0.6);
    const novelty = 0.5; // Placeholder — requires graph community gap analysis
    const actionability = riskLevel === 'high' ? 0.4 : riskLevel === 'medium' ? 0.6 : 0.8;
    const composite = computeComposite({ novelty, evidence: evidenceStrength, confidence, actionability });

    hypotheses.push({
      run_id: runId,
      hypothesis_text: `[${domain}] Evidence cluster from ${source}: ${items.length} items with avg authority ${Math.round(avgAuthority)}. Top excerpt: ${items[0]!.excerpt.substring(0, 200)}`,
      reasoning_trace: `Stage 4 auto-generation: Clustered ${items.length} evidence items from ${source}. Cross-source coverage: ${sourceCount} systems. Authority-weighted relevance applied.`,
      novelty_score: novelty,
      evidence_strength: evidenceStrength,
      confidence: confidence,
      actionability: actionability,
      composite_score: composite,
      citation_ids: citationIds,
      publishable: false,
      verification_passed: null,
    });
    hypothesisIdx++;
  }

  // Batch insert
  if (hypotheses.length > 0) {
    const { error } = await serviceClient
      .from('oracle_run_hypotheses')
      .insert(hypotheses);
    if (error) throw new Error(`Failed to insert hypotheses: ${error.message}`);
  }

  return hypotheses;
}

// ─── Stage 5: Score & Verify ─────────────────────────────────────────

async function scoreAndVerify(
  serviceClient: ReturnType<typeof getServiceClient>,
  runId: string,
  riskLevel: string,
) {
  await updateRunStatus(serviceClient, runId, 'scoring');

  // Fetch hypotheses for this run
  const { data: hypotheses, error } = await serviceClient
    .from('oracle_run_hypotheses')
    .select('id, hypothesis_text, composite_score, evidence_strength, confidence')
    .eq('run_id', runId);

  if (error) throw new Error(`Failed to fetch hypotheses: ${error.message}`);
  if (!hypotheses || hypotheses.length === 0) return { verified: 0, total: 0 };

  await updateRunStatus(serviceClient, runId, 'verification');

  let verifiedCount = 0;
  const verificationRows: Record<string, unknown>[] = [];
  const verifiedHypothesisIds: string[] = [];
  const unverifiedHypothesisIds: string[] = [];

  for (const h of hypotheses) {
    const composite = h.composite_score as number ?? 0;
    const needsAdversarial = riskLevel === 'high' || composite > 0.8;

    // For MVP: auto-verify if evidence strength > 0.6 and confidence > 0.5
    // In production, this calls the generalized verification framework
    const evidenceOk = (h.evidence_strength as number ?? 0) > 0.6;
    const confidenceOk = (h.confidence as number ?? 0) > 0.5;
    const verified = evidenceOk && confidenceOk;

    const verdict = verified ? 'verified' : evidenceOk ? 'partially_verified' : 'unverified';

    verificationRows.push({
      claim_text: h.hypothesis_text,
      hypothesis_id: h.id,
      run_id: runId,
      verdict,
      consensus_score: verified ? 0.75 : 0.4,
      consensus_threshold: 0.667,
      sources_checked: 1,
      sources_agreeing: verified ? 1 : 0,
      adversarial_check_run: needsAdversarial,
      adversarial_result: needsAdversarial ? { note: 'Adversarial check pending — requires LLM integration' } : null,
      verifier_model: 'oracle-ws-pipeline-v1',
    });

    if (verified) {
      verifiedHypothesisIds.push(h.id as string);
      verifiedCount++;
    } else {
      unverifiedHypothesisIds.push(h.id as string);
    }
  }

  const hypothesisUpdates = [];
  if (verifiedHypothesisIds.length > 0) {
    hypothesisUpdates.push(
      serviceClient
        .from('oracle_run_hypotheses')
        .update({
          publishable: true,
          verification_passed: true,
        })
        .in('id', verifiedHypothesisIds),
    );
  }
  if (unverifiedHypothesisIds.length > 0) {
    hypothesisUpdates.push(
      serviceClient
        .from('oracle_run_hypotheses')
        .update({
          publishable: false,
          verification_passed: false,
        })
        .in('id', unverifiedHypothesisIds),
    );
  }
  if (hypothesisUpdates.length > 0) {
    const updateResults = await Promise.all(hypothesisUpdates);
    const firstErr = updateResults.find((r) => r.error)?.error;
    if (firstErr) {
      throw new Error(`Failed to update hypothesis verification flags: ${firstErr.message}`);
    }
  }

  // Batch insert verification results
  if (verificationRows.length > 0) {
    const { error: verificationInsertError } = await serviceClient
      .from('verification_results')
      .insert(verificationRows);

    if (verificationInsertError) {
      throw new Error(`Failed to insert verification results: ${verificationInsertError.message}`);
    }
  }

  return { verified: verifiedCount, total: hypotheses.length };
}

// ─── Compute evaluation summary ──────────────────────────────────────

async function computeEvaluation(
  serviceClient: ReturnType<typeof getServiceClient>,
  runId: string,
) {
  const { data: hypotheses } = await serviceClient
    .from('oracle_run_hypotheses')
    .select('composite_score, novelty_score, evidence_strength, confidence, publishable, citation_ids')
    .eq('run_id', runId);

  if (!hypotheses || hypotheses.length === 0) {
    return {
      hypothesis_count: 0,
      published_count: 0,
      citation_coverage: 0,
      novelty_score: 0,
      avg_confidence: 0,
      avg_evidence_strength: 0,
    };
  }

  const count = hypotheses.length;
  const withCitations = hypotheses.filter(
    (h: Record<string, unknown>) => Array.isArray(h.citation_ids) && (h.citation_ids as string[]).length >= 2,
  ).length;
  const scoreTotal = hypotheses.reduce(
    (sum: number, hypothesis: Record<string, unknown>) => sum + ((hypothesis.composite_score as number) ?? 0),
    0,
  );
  const { data: verificationRows } = await serviceClient
    .from('verification_results')
    .select('sources_checked')
    .eq('run_id', runId);
  const verifiedCount = hypotheses.filter((h: Record<string, unknown>) => h.publishable).length;
  const evidenceDiversity = new Set(
    (verificationRows ?? [])
      .map((row: Record<string, unknown>) => Number(row.sources_checked ?? 0))
      .filter((value) => Number.isFinite(value) && value > 0),
  ).size;

  return {
    hypothesis_count: count,
    published_count: hypotheses.filter((h: Record<string, unknown>) => h.publishable).length,
    citation_coverage: withCitations / count,
    verified_rate: verifiedCount / count,
    evidence_diversity: evidenceDiversity,
    avg_composite_score: scoreTotal / count,
    novelty_score: hypotheses.reduce((s: number, h: Record<string, unknown>) => s + (h.novelty_score as number ?? 0), 0) / count,
    avg_confidence: hypotheses.reduce((s: number, h: Record<string, unknown>) => s + (h.confidence as number ?? 0), 0) / count,
    avg_evidence_strength: hypotheses.reduce((s: number, h: Record<string, unknown>) => s + (h.evidence_strength as number ?? 0), 0) / count,
  };
}

async function persistRunScorecard(
  serviceClient: ReturnType<typeof getServiceClient>,
  runId: string,
  evaluation: Record<string, unknown>,
) {
  const payload = {
    run_id: runId,
    model_version: 'oracle-ws-pipeline-v1',
    hypothesis_count: Number(evaluation.hypothesis_count ?? 0),
    published_count: Number(evaluation.published_count ?? 0),
    citation_coverage: Number(evaluation.citation_coverage ?? 0),
    novelty_score: Number(evaluation.novelty_score ?? 0),
    avg_confidence: Number(evaluation.avg_confidence ?? 0),
    avg_evidence_strength: Number(evaluation.avg_evidence_strength ?? 0),
    verified_rate: Number(evaluation.verified_rate ?? 0),
    evidence_diversity: Number(evaluation.evidence_diversity ?? 0),
    avg_composite_score: Number(evaluation.avg_composite_score ?? 0),
  };
  const { error } = await serviceClient
    .from('oracle_run_scorecards')
    .upsert(payload, { onConflict: 'run_id' });
  if (error) throw new Error(`Failed to persist run scorecard: ${error.message}`);
}

async function enqueueGraphExtractionJob(
  serviceClient: ReturnType<typeof getServiceClient>,
  run: Record<string, unknown>,
) {
  const payload = {
    run_id: run.id as string,
    status: 'pending',
    priority: 50,
    trigger: 'pipeline_execute',
    domain: String(run.domain ?? ''),
    target_entities: Array.isArray(run.target_entities)
      ? (run.target_entities as unknown[]).map((value) => String(value))
      : [],
    metadata: {
      queued_by: 'oracle-ws-pipeline',
      queued_at: new Date().toISOString(),
    },
  };
  const { error } = await serviceClient
    .from('oracle_graph_extraction_jobs')
    .upsert(payload, { onConflict: 'run_id' });
  if (error) throw new Error(`Failed to enqueue graph extraction job: ${error.message}`);
}

// ─── Main handler ────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const serviceClient = getServiceClient();
    const callerClient = getSupabaseClient(req);

    // ── GET: retrieve run(s) ──────────────────────────────────────
    if (req.method === 'GET') {
      const runId = url.searchParams.get('id');

      if (runId) {
        const { data: run, error } = await callerClient
          .from('oracle_whitespace_runs')
          .select('*')
          .eq('id', runId)
          .maybeSingle();

        if (error) return errorResponse(error.message, 500);
        if (!run) return errorResponse('Run not found', 404);

        // Fetch related data in parallel
        const [hypothesesResult, evidenceResult, evaluation] = await Promise.all([
          callerClient
            .from('oracle_run_hypotheses')
            .select('*')
            .eq('run_id', runId)
            .order('composite_score', { ascending: false }),
          callerClient
            .from('oracle_run_evidence')
            .select('id, source_type, source_ref, source_system, authority_score, relevance_score, content_excerpt')
            .eq('run_id', runId)
            .order('authority_score', { ascending: false }),
          computeEvaluation(serviceClient, runId),
        ]);

        if (hypothesesResult.error) return errorResponse(hypothesesResult.error.message, 500);
        if (evidenceResult.error) return errorResponse(evidenceResult.error.message, 500);

        return jsonResponse({
          run,
          hypotheses: hypothesesResult.data ?? [],
          evidence: evidenceResult.data ?? [],
          evaluation,
        });
      }

      // List recent runs
      const limit = Math.min(
        Math.max(parseInt(url.searchParams.get('limit') ?? '20', 10), 1),
        100,
      );
      const domain = url.searchParams.get('domain');

      let query = callerClient
        .from('oracle_whitespace_runs')
        .select('id, domain, run_label, status, risk_level, evaluation, created_at, completed_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (domain) query = query.eq('domain', domain);

      const { data: runs, error } = await query;
      if (error) return errorResponse(error.message, 500);

      return jsonResponse({ runs: runs ?? [] });
    }

    // ── POST: create, execute, publish, or record outcome ─────────
    if (req.method === 'POST') {
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;

      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      const action = url.searchParams.get('action') ?? 'create';

      // ── Create a new run ────────────────────────────────────────
      if (action === 'create') {
        const body = await validateBody<CreateRunRequest>(req, [
          { name: 'domain', type: 'string' },
          { name: 'targetEntities', type: 'object' },
          { name: 'constraints', type: 'object' },
          { name: 'evidenceSourcesAllowed', type: 'object' },
          { name: 'riskLevel', type: 'string' },
          { name: 'timeHorizon', type: 'string', required: false },
          { name: 'runLabel', type: 'string', required: false },
        ]);
        if (!body.ok) return body.response;

        if (!['low', 'medium', 'high'].includes(body.data.riskLevel)) {
          return errorResponse('riskLevel must be low, medium, or high', 400);
        }
        if (!Array.isArray(body.data.targetEntities) || !body.data.targetEntities.every((value) => typeof value === 'string')) {
          return errorResponse('targetEntities must be an array of strings', 400);
        }
        if (
          !Array.isArray(body.data.evidenceSourcesAllowed)
          || !body.data.evidenceSourcesAllowed.every((value) => typeof value === 'string')
        ) {
          return errorResponse('evidenceSourcesAllowed must be an array of strings', 400);
        }

        const run = await createRun(serviceClient, auth.claims.userId, body.data);
        return jsonResponse({ run, status: 'queued' }, 201);
      }

      // ── Execute a queued run through the pipeline ───────────────
      if (action === 'execute') {
        const body = await validateBody<ExecuteRunRequest>(req, [
          { name: 'runId', type: 'string' },
        ]);
        if (!body.ok) return body.response;

        const { data: run, error } = await serviceClient
          .from('oracle_whitespace_runs')
          .select('*')
          .eq('id', body.data.runId)
          .single();

        if (error || !run) return errorResponse('Run not found', 404);

        if (!['queued', 'failed'].includes(run.status)) {
          return errorResponse(`Run is in ${run.status} state; only queued or failed runs can be executed`, 409);
        }
        if (run.status === 'failed') {
          const [verificationCleanup, hypothesesCleanup, evidenceCleanup] = await Promise.all([
            serviceClient
              .from('verification_results')
              .delete()
              .eq('run_id', run.id),
            serviceClient
              .from('oracle_run_hypotheses')
              .delete()
              .eq('run_id', run.id),
            serviceClient
              .from('oracle_run_evidence')
              .delete()
              .eq('run_id', run.id),
          ]);

          const cleanupError = verificationCleanup.error ?? hypothesesCleanup.error ?? evidenceCleanup.error;
          if (cleanupError) {
            return errorResponse(`Failed to reset prior pipeline artifacts: ${cleanupError.message}`, 500);
          }
        }

        const startedAt = new Date().toISOString();
        await updateRunStatus(serviceClient, run.id, 'gathering_evidence', { started_at: startedAt });

        try {
          // Stage 2: Gather Evidence
          const evidenceCount = await gatherEvidence(serviceClient, run);

          // Stage 3: Resolve Entities
          const entityResolution = await resolveEntities(serviceClient, run.id);

          // Stage 4: Generate Hypotheses
          const hypotheses = await generateHypotheses(
            serviceClient,
            run.id,
            run.domain,
            run.risk_level,
          );

          // Stage 5: Score & Verify
          const verification = await scoreAndVerify(
            serviceClient,
            run.id,
            run.risk_level,
          );

          // Compute evaluation summary
          const evaluation = await computeEvaluation(serviceClient, run.id);
          await persistRunScorecard(serviceClient, run.id, evaluation);
          await enqueueGraphExtractionJob(serviceClient, run);

          // Mark run as ready for review
          await updateRunStatus(serviceClient, run.id, 'review', {
            completed_at: new Date().toISOString(),
            evaluation,
            stage_progress: {
              evidence_gathered: evidenceCount,
              entities_resolved: entityResolution.uniqueEntities,
              entity_mention_links: entityResolution.mentionLinks,
              unresolved_entity_chunks: entityResolution.unresolvedChunkCount,
              hypotheses_generated: hypotheses.length,
              verified: verification.verified,
              total_hypotheses: verification.total,
              graph_extraction_job: 'pending',
            },
          });
          await serviceClient.from('eigen_governance_audit_log').insert([{
            event_type: 'run_review_ready',
            run_id: run.id,
            actor_id: auth.claims.userId,
            details: {
              evidence_gathered: evidenceCount,
              entities_resolved: entityResolution.uniqueEntities,
              hypotheses_generated: hypotheses.length,
              hypotheses_verified: verification.verified,
              evaluation,
            },
          }]);

          return jsonResponse({
            run_id: run.id,
            status: 'review',
            pipeline_summary: {
              evidence_gathered: evidenceCount,
              entities_resolved: entityResolution.uniqueEntities,
              entity_mention_links: entityResolution.mentionLinks,
              unresolved_entity_chunks: entityResolution.unresolvedChunkCount,
              hypotheses_generated: hypotheses.length,
              hypotheses_verified: verification.verified,
              hypotheses_total: verification.total,
              evaluation,
            },
          });
        } catch (pipelineErr) {
          const msg = pipelineErr instanceof Error ? pipelineErr.message : 'Pipeline error';
          await updateRunStatus(serviceClient, run.id, 'failed', {
            error_message: msg,
          });
          return errorResponse(`Pipeline failed: ${msg}`, 500);
        }
      }

      // ── Publish hypotheses from a completed run ─────────────────
      if (action === 'publish') {
        const body = await validateBody<PublishRequest>(req, [
          { name: 'runId', type: 'string' },
          { name: 'hypothesisIds', type: 'object' },
          { name: 'publicationNotes', type: 'string' },
        ]);
        if (!body.ok) return body.response;
        if (!Array.isArray(body.data.hypothesisIds) || !body.data.hypothesisIds.every((value) => typeof value === 'string')) {
          return errorResponse('hypothesisIds must be an array of strings', 400);
        }

        const { data: run } = await serviceClient
          .from('oracle_whitespace_runs')
          .select('id, status')
          .eq('id', body.data.runId)
          .single();

        if (!run) return errorResponse('Run not found', 404);
        if (run.status !== 'review') {
          return errorResponse('Run must be in review status to publish', 409);
        }

        // Create oracle_theses from selected hypotheses
        const requestedHypothesisIds = [...new Set(body.data.hypothesisIds)];
        const { data: selectedHypotheses, error: selectedHypothesesError } = await serviceClient
          .from('oracle_run_hypotheses')
          .select('*')
          .in('id', requestedHypothesisIds)
          .eq('run_id', body.data.runId);
        if (selectedHypothesesError) {
          return errorResponse(selectedHypothesesError.message, 500);
        }

        if (!selectedHypotheses || selectedHypotheses.length === 0) {
          return errorResponse('No matching hypotheses found for this run', 404);
        }
        if (selectedHypotheses.length !== requestedHypothesisIds.length) {
          return errorResponse('One or more hypotheses do not belong to this run', 400);
        }

        const unpublishedHypotheses = selectedHypotheses.filter(
          (hypothesis) => hypothesis.publishable !== true || hypothesis.verification_passed !== true,
        );
        if (unpublishedHypotheses.length > 0) {
          return errorResponse('All selected hypotheses must be verified and publishable before publishing', 409);
        }

        const publishedThesisIds: string[] = [];

        for (const h of selectedHypotheses) {
          // Create thesis from hypothesis
          const { data: thesis, error: thErr } = await serviceClient
            .from('oracle_theses')
            .insert([{
              profile_id: auth.claims.userId,
              title: (h.hypothesis_text as string).substring(0, 200),
              thesis_statement: h.hypothesis_text,
              status: 'active',
              confidence: Math.round((h.confidence as number ?? 0.5) * 100),
              evidence_strength: Math.round((h.evidence_strength as number ?? 0) * 100),
              publication_state: 'published',
              published_at: new Date().toISOString(),
              published_by: auth.claims.userId,
              metadata: {
                source_run_id: body.data.runId,
                source_hypothesis_id: h.id,
                composite_score: h.composite_score,
                novelty_score: h.novelty_score,
                actionability: h.actionability,
              },
            }])
            .select('id')
            .single();

          if (thErr) throw new Error(`Failed to create thesis: ${thErr.message}`);

          // Link hypothesis to thesis
          const { error: linkErr } = await serviceClient
            .from('oracle_run_hypotheses')
            .update({ thesis_id: thesis!.id })
            .eq('id', h.id);
          if (linkErr) throw new Error(`Failed to link hypothesis to thesis: ${linkErr.message}`);

          // Write publication event
          const { error: pubEventErr } = await serviceClient
            .from('oracle_publication_events')
            .insert([{
              target_type: 'thesis',
              target_id: thesis!.id,
              from_state: 'pending_review',
              to_state: 'published',
              decided_by: auth.claims.userId,
              notes: body.data.publicationNotes,
              metadata: { source_run_id: body.data.runId },
            }]);
          if (pubEventErr) throw new Error(`Failed to write publication event: ${pubEventErr.message}`);
          await serviceClient.from('eigen_governance_audit_log').insert([{
            event_type: 'hypothesis_published',
            run_id: body.data.runId,
            thesis_id: thesis!.id,
            actor_id: auth.claims.userId,
            details: {
              hypothesis_id: h.id,
              publication_notes: body.data.publicationNotes,
              confidence: h.confidence,
              evidence_strength: h.evidence_strength,
              composite_score: h.composite_score,
            },
          }]);

          publishedThesisIds.push(thesis!.id);
        }

        // Update run to published
        const evaluation = await computeEvaluation(serviceClient, body.data.runId);
        await updateRunStatus(serviceClient, body.data.runId, 'published', { evaluation });
        await serviceClient.from('eigen_governance_audit_log').insert([{
          event_type: 'run_published',
          run_id: body.data.runId,
          actor_id: auth.claims.userId,
          details: {
            thesis_ids: publishedThesisIds,
            published_count: publishedThesisIds.length,
            evaluation,
          },
        }]);

        return jsonResponse({
          published_count: publishedThesisIds.length,
          thesis_ids: publishedThesisIds,
          run_status: 'published',
        });
      }

      // ── Record an outcome ───────────────────────────────────────
      if (action === 'outcome') {
        const body = await validateBody<OutcomeRequest>(req, [
          { name: 'thesisId', type: 'string' },
          { name: 'verdict', type: 'string' },
          { name: 'summary', type: 'string' },
          { name: 'evidenceRefs', type: 'object' },
          { name: 'observedAt', type: 'string' },
        ]);
        if (!body.ok) return body.response;
        if (!Array.isArray(body.data.evidenceRefs) || !body.data.evidenceRefs.every((value) => typeof value === 'object' && value !== null && !Array.isArray(value))) {
          return errorResponse('evidenceRefs must be an array of objects', 400);
        }

        // Fetch thesis for calibration
        const { data: thesis } = await serviceClient
          .from('oracle_theses')
          .select('id, confidence, evidence_strength')
          .eq('id', body.data.thesisId)
          .single();

        if (!thesis) return errorResponse('Thesis not found', 404);

        // Insert outcome
        const { data: outcome, error: outErr } = await serviceClient
          .from('oracle_outcomes')
          .insert([{
            thesis_id: body.data.thesisId,
            verdict: body.data.verdict,
            summary: body.data.summary,
            evidence_refs: body.data.evidenceRefs,
            observed_at: body.data.observedAt,
            outcome_source: 'manual',
          }])
          .select()
          .single();

        if (outErr) throw new Error(`Failed to insert outcome: ${outErr.message}`);

        // Compute calibration
        const predictedConfidence = (thesis.confidence as number) / 100;
        const accuracyMap: Record<string, number> = {
          confirmed: 1.0,
          partially_confirmed: 0.6,
          refuted: 0.0,
          inconclusive: 0.5,
        };
        const accuracyScore = accuracyMap[body.data.verdict] ?? 0.5;
        const calibrationError = Math.abs(predictedConfidence - accuracyScore);
        const confidenceDelta = accuracyScore - predictedConfidence;

        // Write calibration log
        const { error: calibrationErr } = await serviceClient
          .from('oracle_calibration_log')
          .insert([{
            thesis_id: body.data.thesisId,
            outcome_id: outcome!.id,
            predicted_confidence: predictedConfidence,
            predicted_evidence_strength: (thesis.evidence_strength as number) / 100,
            actual_verdict: body.data.verdict,
            accuracy_score: accuracyScore,
            calibration_error: calibrationError,
            confidence_delta: confidenceDelta,
            model_version: 'oracle-ws-pipeline-v1',
          }]);
        if (calibrationErr) throw new Error(`Failed to write calibration log: ${calibrationErr.message}`);
        await serviceClient.from('eigen_governance_audit_log').insert([{
          event_type: 'outcome_recorded',
          run_id: null,
          thesis_id: body.data.thesisId,
          actor_id: auth.claims.userId,
          details: {
            verdict: body.data.verdict,
            outcome_id: outcome!.id,
            accuracy_score: accuracyScore,
            calibration_error: calibrationError,
            confidence_delta: confidenceDelta,
          },
        }]);

        return jsonResponse({
          outcome_id: outcome!.id,
          accuracy_score: accuracyScore,
          calibration_error: calibrationError,
          confidence_delta: confidenceDelta,
        }, 201);
      }

      return errorResponse(`Unknown action: ${action}`, 400);
    }

    return errorResponse('Method not allowed', 405);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
