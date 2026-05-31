import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { buildChunks, embedTexts, sha256Hex } from '../_shared/eigen.ts';
import {
  computeNextRetryAt,
  inferSignalPolicyTags,
  timingSafeEqual,
} from '../_shared/signal-utils.ts';
import {
  findCoffeeCounterpartyMegResolveArgs,
  inferActorMegResolveArgs,
  inferRelatedMegResolveArgsList,
  isCoffeePairingSignal,
  isUuid,
  sanitizeMegResolveRpcArgs,
  type FeedRowForMeg,
} from '../_shared/meg-resolve-signal.ts';
import { linkKbFourPortfolioAnchor } from '../_shared/meg-kb-four-linkage.ts';
import {
  applyEntityFieldUpdateFromFeedRow,
  emitEntityUpdatedProjection,
  isEntityFieldUpdateEvent,
  isEntityUpdatedProjectionEvent,
} from '../_shared/entity-sync.ts';

const SERVICE_ROLE_OWNER_ID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_BATCH_LIMIT = 15;
/** Hard cap per invocation; matches cron `limit=` and claim RPC backpressure. */
const MAX_BATCH_LIMIT = 25;
/** Must match `max_attempts` in `claim_platform_feed_items` (signal_contract migrations). */
const MAX_SIGNAL_PROCESS_ATTEMPTS = 10;

type AutonomyActionClass = 'observe' | 'propose' | 'act' | 'irreversible';
type AutonomyDecision = 'auto_publish' | 'needs_review' | 'blocked';

type SignalConfidencePolicy = {
  actionClass: AutonomyActionClass;
  minConfidence: number;
  allowAutonomous: boolean;
  requireOperatorReview: boolean;
};

type AutonomyEvaluation = {
  actionClass: AutonomyActionClass;
  decision: AutonomyDecision;
  threshold: number;
  confidence: number;
  reason: string;
};

const DEFAULT_SIGNAL_CONFIDENCE_POLICIES: Record<AutonomyActionClass, SignalConfidencePolicy> = {
  observe: {
    actionClass: 'observe',
    minConfidence: 0.4,
    allowAutonomous: true,
    requireOperatorReview: false,
  },
  propose: {
    actionClass: 'propose',
    minConfidence: 0.65,
    allowAutonomous: true,
    requireOperatorReview: false,
  },
  act: {
    actionClass: 'act',
    minConfidence: 0.85,
    allowAutonomous: true,
    requireOperatorReview: false,
  },
  irreversible: {
    actionClass: 'irreversible',
    minConfidence: 0.95,
    allowAutonomous: false,
    requireOperatorReview: true,
  },
};

/** True when `x-r2-signal-process-token` matches configured `R2_SIGNAL_PROCESS_TOKEN`. */
function resolveTrustedProcessCaller(req: Request): boolean {
  const configured = Deno.env.get('R2_SIGNAL_PROCESS_TOKEN')?.trim();
  if (!configured) return false;
  const provided = req.headers.get('x-r2-signal-process-token')?.trim();
  return Boolean(provided && timingSafeEqual(provided, configured));
}

/** Parses `limit` query param or env override, clamped to [1, MAX_BATCH_LIMIT]. */
function parseBatchLimit(req: Request): number {
  const url = new URL(req.url);
  const raw =
    url.searchParams.get('limit') ??
    Deno.env.get('R2_SIGNAL_PROCESS_BATCH_LIMIT') ??
    String(DEFAULT_BATCH_LIMIT);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_BATCH_LIMIT;
  return Math.min(parsed, MAX_BATCH_LIMIT);
}

type FeedRow = {
  id: string;
  source_system: string;
  source_event_type: string;
  source_signal_key?: string;
  summary: string;
  payload: Record<string, unknown>;
  confidence: number | null;
  privacy_level: 'public' | 'members' | 'operator' | 'private';
  event_time: string;
  related_entity_ids: string[];
  routing_targets: string[];
  actor_meg_entity_id?: string | null;
};

function normalizeConfidence(value: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function inferAutonomyActionClass(row: FeedRow): AutonomyActionClass {
  const targets = row.routing_targets ?? [];
  const publishAdjacent = row.privacy_level === 'public' || targets.includes('commons_publish');
  if (publishAdjacent) return 'irreversible';
  if (targets.includes('charter') || targets.includes('oracle')) return 'act';
  if (targets.includes('operator_workbench')) return 'propose';
  return 'observe';
}

function resolvePolicy(
  actionClass: AutonomyActionClass,
  policies: Map<AutonomyActionClass, SignalConfidencePolicy>,
): SignalConfidencePolicy {
  return policies.get(actionClass) ?? DEFAULT_SIGNAL_CONFIDENCE_POLICIES[actionClass];
}

// Advisory bot reviews are recommendations for the operator/principal — they
// must never auto-publish or hard-block on confidence; they always route to the
// Review lane for triage and Accept/Reject. (REGENT is advisory-only.)
const ADVISORY_REVIEW_EVENT_TYPES = new Set([
  'regent_executive_review',
  'paralegal_schedule_published',
]);

function evaluateAutonomy(
  row: FeedRow,
  policies: Map<AutonomyActionClass, SignalConfidencePolicy>,
): AutonomyEvaluation {
  const actionClass = inferAutonomyActionClass(row);
  const policy = resolvePolicy(actionClass, policies);
  const confidence = normalizeConfidence(row.confidence);
  if (ADVISORY_REVIEW_EVENT_TYPES.has(row.source_event_type)) {
    return {
      actionClass,
      decision: 'needs_review',
      threshold: policy.minConfidence,
      confidence,
      reason: 'advisory executive review — operator triage required (REGENT never auto-acts)',
    };
  }
  if (confidence < policy.minConfidence) {
    return {
      actionClass,
      decision: 'blocked',
      threshold: policy.minConfidence,
      confidence,
      reason: `confidence ${confidence.toFixed(3)} below ${actionClass} threshold ${policy.minConfidence.toFixed(3)}`,
    };
  }
  if (!policy.allowAutonomous || policy.requireOperatorReview) {
    return {
      actionClass,
      decision: 'needs_review',
      threshold: policy.minConfidence,
      confidence,
      reason: `${actionClass} class requires operator review`,
    };
  }
  return {
    actionClass,
    decision: 'auto_publish',
    threshold: policy.minConfidence,
    confidence,
    reason: `${actionClass} class passed confidence boundary`,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseAutonomyActionClass(value: unknown): AutonomyActionClass | null {
  if (value === 'observe' || value === 'propose' || value === 'act' || value === 'irreversible') {
    return value;
  }
  return null;
}

function parseCalibrationDirection(value: unknown): 'tighten' | 'loosen' | 'none' | null {
  if (value === 'tighten' || value === 'loosen' || value === 'none') return value;
  return null;
}

async function maybeApplyAutonomyFeedbackCalibration(
  client: ReturnType<typeof getServiceClient>,
  row: FeedRow,
  policies: Map<AutonomyActionClass, SignalConfidencePolicy>,
): Promise<void> {
  if (
    row.source_system !== 'operator_workbench' ||
    row.source_event_type !== 'operator_decision_feedback'
  ) {
    return;
  }
  const payload = asRecord(row.payload);
  if (!payload) return;

  const actionClass = parseAutonomyActionClass(payload.target_autonomy_action_class);
  if (!actionClass) return;
  const direction = parseCalibrationDirection(payload.calibration_direction);
  if (!direction || direction === 'none') return;

  const current = resolvePolicy(actionClass, policies);
  const step = 0.01;
  const candidate =
    direction === 'tighten'
      ? Math.min(1, current.minConfidence + step)
      : Math.max(0, current.minConfidence - step);
  if (candidate === current.minConfidence) return;

  const update = await client
    .from('signal_confidence_policies')
    .update({
      min_confidence: candidate,
      updated_at: new Date().toISOString(),
    })
    .eq('action_class', actionClass);
  if (update.error) {
    throw new Error(`signal_confidence_policies update failed: ${update.error.message}`);
  }

  policies.set(actionClass, { ...current, minConfidence: candidate });
}

async function loadSignalConfidencePolicies(
  client: ReturnType<typeof getServiceClient>,
): Promise<Map<AutonomyActionClass, SignalConfidencePolicy>> {
  const policies = new Map<AutonomyActionClass, SignalConfidencePolicy>();
  (['observe', 'propose', 'act', 'irreversible'] as AutonomyActionClass[]).forEach(
    (actionClass) => {
      policies.set(actionClass, DEFAULT_SIGNAL_CONFIDENCE_POLICIES[actionClass]);
    },
  );
  const res = await client
    .from('signal_confidence_policies')
    .select('action_class, min_confidence, allow_autonomous, require_operator_review');
  if (res.error) {
    return policies;
  }
  for (const row of res.data ?? []) {
    const actionClass = String(row.action_class) as AutonomyActionClass;
    if (!policies.has(actionClass)) continue;
    const next: SignalConfidencePolicy = {
      actionClass,
      minConfidence: normalizeConfidence(Number(row.min_confidence)),
      allowAutonomous: Boolean(row.allow_autonomous),
      requireOperatorReview: Boolean(row.require_operator_review),
    };
    policies.set(actionClass, next);
  }
  return policies;
}

function toFeedRowForMeg(row: FeedRow): FeedRowForMeg {
  return {
    id: row.id,
    source_system: row.source_system,
    source_event_type: row.source_event_type,
    summary: row.summary,
    payload: row.payload ?? {},
    actor_meg_entity_id: row.actor_meg_entity_id,
    related_entity_ids: row.related_entity_ids,
  };
}

/**
 * When ingest left actor_meg_entity_id null but the payload carries a stable
 * email or actor id, resolve (or create) the MEG node and persist the link on
 * platform_feed_items so retrieval and downstream joins see the same UUID.
 */
async function ensureActorMegEntityLinked(
  client: ReturnType<typeof getServiceClient>,
  row: FeedRow,
): Promise<FeedRow> {
  const args = inferActorMegResolveArgs(row);
  if (!args) return row;

  const { data: megId, error } = await client.rpc(
    'meg_resolve_or_create',
    sanitizeMegResolveRpcArgs(args),
  );
  if (error) {
    throw new Error(`meg_resolve_or_create: ${error.message}`);
  }
  if (!megId) {
    throw new Error('meg_resolve_or_create returned empty');
  }

  const upd = await client
    .from('platform_feed_items')
    .update({ actor_meg_entity_id: megId as string })
    .eq('id', row.id)
    .is('actor_meg_entity_id', null)
    .select('id')
    .maybeSingle();
  if (upd.error) {
    throw new Error(upd.error.message);
  }
  if (!upd.data) {
    const { data: refreshed, error: refErr } = await client
      .from('platform_feed_items')
      .select(
        'id, source_system, source_event_type, summary, payload, confidence, privacy_level, event_time, related_entity_ids, routing_targets, actor_meg_entity_id',
      )
      .eq('id', row.id)
      .maybeSingle();
    if (refErr) throw new Error(refErr.message);
    return refreshed ? { ...(refreshed as FeedRow) } : row;
  }

  return { ...row, actor_meg_entity_id: megId as string };
}

/** Merges UUID + inferred MEG ids into `related_entity_ids` on the feed row. */
async function ensureRelatedMegEntitiesLinked(
  client: ReturnType<typeof getServiceClient>,
  row: FeedRow,
): Promise<FeedRow> {
  const existing = (row.related_entity_ids ?? []).filter((id) => isUuid(id));
  const inferred = inferRelatedMegResolveArgsList(row);
  const merged = new Set<string>(existing);

  const resolved = await Promise.all(
    inferred.map((args) => client.rpc('meg_resolve_or_create', sanitizeMegResolveRpcArgs(args))),
  );
  for (const { data: megId, error } of resolved) {
    if (error) {
      throw new Error(`meg_resolve_or_create related: ${error.message}`);
    }
    if (megId && isUuid(String(megId))) {
      merged.add(String(megId));
    }
  }

  const next = [...merged];
  const sameSize = next.length === existing.length;
  const sameMembers = sameSize && existing.every((id) => merged.has(id));
  if (sameMembers) {
    return { ...row, related_entity_ids: next };
  }

  const upd = await client
    .from('platform_feed_items')
    .update({ related_entity_ids: next })
    .eq('id', row.id);
  if (upd.error) {
    throw new Error(upd.error.message);
  }

  return { ...row, related_entity_ids: next };
}

async function resolveCoffeeCounterpartyMegEntityId(
  client: ReturnType<typeof getServiceClient>,
  row: FeedRow,
): Promise<string | null> {
  const args = findCoffeeCounterpartyMegResolveArgs(toFeedRowForMeg(row));
  if (!args) return null;
  const { data, error } = await client.rpc(
    'meg_resolve_or_create',
    sanitizeMegResolveRpcArgs(args),
  );
  if (error) {
    throw new Error(`meg_resolve_or_create coffee counterparty: ${error.message}`);
  }
  if (data && isUuid(String(data))) return String(data);
  return null;
}

/** Records a `coffee_pairing` MEG edge when the signal is a coffee-match pairing. */
async function maybeRecordCoffeePairingEdge(
  client: ReturnType<typeof getServiceClient>,
  row: FeedRow,
): Promise<void> {
  if (!isCoffeePairingSignal(row)) return;
  const actorId = row.actor_meg_entity_id;
  if (!actorId || !isUuid(actorId)) return;
  const target = await resolveCoffeeCounterpartyMegEntityId(client, row);
  if (!target || !isUuid(target)) return;

  const { error } = await client.rpc('meg_link_entities', {
    p_source_entity_id: actorId,
    p_target_entity_id: target,
    p_edge_type: 'coffee_pairing',
    p_metadata: {
      platform_feed_item_id: row.id,
      source_event_type: row.source_event_type,
    },
  });
  if (error) {
    throw new Error(`meg_link_entities: ${error.message}`);
  }
}

/**
 * Writes resolved MEG UUIDs onto `coffee_matches` when the signal payload
 * carries `coffee_match_id` (r2app `coffee_match_created` contract).
 */
async function syncCoffeeMatchesMegIds(
  client: ReturnType<typeof getServiceClient>,
  row: FeedRow,
): Promise<void> {
  if (!isCoffeePairingSignal(row)) return;
  const p = row.payload ?? {};
  const matchId =
    typeof p.coffee_match_id === 'string' && isUuid(p.coffee_match_id) ? p.coffee_match_id : null;
  if (!matchId) return;

  const actorId = row.actor_meg_entity_id;
  if (!actorId || !isUuid(actorId)) return;

  const target = await resolveCoffeeCounterpartyMegEntityId(client, row);
  const upd: { actor_meg_entity_id: string; matched_meg_entity_id?: string | null } = {
    actor_meg_entity_id: actorId,
  };
  if (target && isUuid(target)) {
    upd.matched_meg_entity_id = target;
  }

  const { data, error } = await client
    .from('coffee_matches')
    .update(upd)
    .eq('id', matchId)
    .select('id')
    .maybeSingle();
  if (error) {
    throw new Error(`coffee_matches MEG sync: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error(`coffee_matches MEG sync: no row updated for id ${matchId}`);
  }
}

/** Marks a feed item failed (retryable) or deadletter (terminal after attempt budget). */
async function markSignalFailed(signalId: string, message: string): Promise<void> {
  const client = getServiceClient();
  const { data: row, error } = await client
    .from('platform_feed_items')
    .select('attempt_count')
    .eq('id', signalId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  const attempts = row?.attempt_count ?? 0;
  const terminal = attempts >= MAX_SIGNAL_PROCESS_ATTEMPTS ? 'deadletter' : 'failed';
  const nextRetryAt = terminal === 'deadletter' ? null : computeNextRetryAt();
  await client
    .from('platform_feed_items')
    .update({
      processing_status: terminal,
      error: message.slice(0, 2000),
      next_retry_at: nextRetryAt,
      processed_at: new Date().toISOString(),
    })
    .eq('id', signalId);
}

/**
 * Fast path for cross-site entity sync: apply projection patches or acknowledge
 * projection emits without full embedding pipeline.
 */
async function maybeProcessEntitySyncSignal(
  client: ReturnType<typeof getServiceClient>,
  row: FeedRow,
  policies: Map<AutonomyActionClass, SignalConfidencePolicy>,
): Promise<boolean> {
  if (isEntityUpdatedProjectionEvent(row.source_event_type)) {
    const autonomy = evaluateAutonomy(row, policies);
    await persistAutonomyDecision(client, row.id, autonomy, 'published');
    return true;
  }

  if (!isEntityFieldUpdateEvent(row.source_event_type)) {
    return false;
  }

  const applyResult = await applyEntityFieldUpdateFromFeedRow(client, row);
  if (applyResult.applied && applyResult.megEntityId && applyResult.fields) {
    await emitEntityUpdatedProjection(client, row, applyResult.megEntityId, applyResult.fields);
  }

  const autonomy = evaluateAutonomy(row, policies);
  await persistAutonomyDecision(client, row.id, autonomy, 'published');
  return true;
}

async function persistAutonomyDecision(
  client: ReturnType<typeof getServiceClient>,
  signalId: string,
  evaluation: AutonomyEvaluation,
  processingStatus: 'scored' | 'published',
): Promise<void> {
  const update = await client
    .from('platform_feed_items')
    .update({
      autonomy_action_class: evaluation.actionClass,
      autonomy_decision: evaluation.decision,
      autonomy_threshold: evaluation.threshold,
      autonomy_reason: evaluation.reason,
      autonomy_decided_at: new Date().toISOString(),
      processing_status: processingStatus,
      processed_at: new Date().toISOString(),
      error: null,
    })
    .eq('id', signalId);
  if (update.error) {
    throw new Error(update.error.message);
  }
}

/** Chunks signal content, embeds, writes document + ingestion run + evidence, marks published. */
async function processOneSignal(
  row: FeedRow,
  evidenceProfileId: string,
  autonomy: AutonomyEvaluation,
): Promise<void> {
  const client = getServiceClient();
  const signalRef = `platform_feed_items:${row.id}`;
  const documentTitle = `Signal ${row.source_system}:${row.source_event_type}`;
  const documentBody = `${row.summary}\n\n${JSON.stringify(row.payload, null, 2)}`;
  const policyTags = inferSignalPolicyTags(
    row.source_system,
    row.privacy_level,
    row.routing_targets,
  );
  const contentHash = await sha256Hex(`${documentTitle}\u001f${documentBody}`);

  const runUpsert = await client
    .from('ingestion_runs')
    .upsert(
      {
        source_system: row.source_system,
        source_ref: signalRef,
        chunking_mode: 'hierarchical',
        embedding_model: 'text-embedding-3-small',
        status: 'running',
        metadata: {
          signal_id: row.id,
          source_event_type: row.source_event_type,
          privacy_level: row.privacy_level,
          routing_targets: row.routing_targets,
          autonomy_action_class: autonomy.actionClass,
          autonomy_decision: autonomy.decision,
          autonomy_threshold: autonomy.threshold,
        },
      },
      { onConflict: 'source_system,source_ref' },
    )
    .select('id')
    .single();

  if (runUpsert.error || !runUpsert.data?.id) {
    throw new Error(runUpsert.error?.message ?? 'Failed to upsert ingestion run');
  }
  const ingestionRunId = runUpsert.data.id as string;

  const docUpsert = await client
    .from('documents')
    .upsert(
      {
        source_system: row.source_system,
        source_ref: signalRef,
        owner_id: SERVICE_ROLE_OWNER_ID,
        title: documentTitle,
        body: documentBody,
        content_type: 'r2_signal_envelope',
        content_hash: contentHash,
        index_status: 'indexed',
        embedding_status: 'embedded',
        extracted_text_status: 'extracted',
        confidence: row.confidence,
        captured_at: row.event_time,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source_system,source_ref' },
    )
    .select('id')
    .single();

  if (docUpsert.error || !docUpsert.data?.id) {
    throw new Error(docUpsert.error?.message ?? 'Failed to upsert signal document');
  }
  const documentId = docUpsert.data.id as string;

  const wipeChunks = await client.from('knowledge_chunks').delete().eq('document_id', documentId);
  if (wipeChunks.error) {
    throw new Error(wipeChunks.error.message);
  }

  const chunks = buildChunks(documentTitle, documentBody, 'hierarchical');
  const { embeddings, model } = await embedTexts(
    chunks.map((chunk) => chunk.content),
    'text-embedding-3-small',
  );

  const hashes = await Promise.all(
    chunks.map((chunk) => sha256Hex(`${documentId}:${chunk.chunkLevel}:${chunk.content}`)),
  );

  const related = [...(row.related_entity_ids ?? [])];
  const actorId = row.actor_meg_entity_id;
  if (actorId && !related.includes(actorId)) {
    related.unshift(actorId);
  }

  const chunkRows = chunks.map((chunk, idx) => ({
    document_id: documentId,
    chunk_level: chunk.chunkLevel,
    heading_path: chunk.headingPath,
    entity_ids: related,
    policy_tags: policyTags,
    authority_score: row.privacy_level === 'public' ? 70 : 85,
    freshness_score: 100,
    provenance_completeness: 100,
    content: chunk.content,
    content_hash: hashes[idx],
    embedding_version: model,
    ingestion_run_id: ingestionRunId,
    embedding: embeddings[idx],
  }));

  if (chunkRows.length > 0) {
    const insertedChunks = await client.from('knowledge_chunks').insert(chunkRows);
    if (insertedChunks.error) {
      throw new Error(insertedChunks.error.message);
    }
  }

  const evidenceInsert = await client
    .from('oracle_evidence_items')
    .insert({
      profile_id: evidenceProfileId,
      source_lane: 'signal_contract',
      source_class: row.source_system,
      source_ref: signalRef,
      content_summary: row.summary,
      confidence: Math.round((row.confidence ?? 0.5) * 100),
      evidence_strength: Math.round((row.confidence ?? 0.5) * 100),
      source_date: row.event_time,
      metadata: {
        signal_id: row.id,
        source_event_type: row.source_event_type,
        privacy_level: row.privacy_level,
        routing_targets: row.routing_targets,
        autonomy_action_class: autonomy.actionClass,
        autonomy_decision: autonomy.decision,
        autonomy_threshold: autonomy.threshold,
      },
    })
    .select('id')
    .single();

  if (evidenceInsert.error || !evidenceInsert.data?.id) {
    throw new Error(evidenceInsert.error?.message ?? 'Failed to create oracle evidence item');
  }

  const finalizeRun = await client
    .from('ingestion_runs')
    .update({
      document_id: documentId,
      status: 'completed',
      chunk_count: chunkRows.length,
      completed_at: new Date().toISOString(),
    })
    .eq('id', ingestionRunId);
  if (finalizeRun.error) {
    throw new Error(finalizeRun.error.message);
  }

  await persistAutonomyDecision(client, row.id, autonomy, 'published');
  const finalizeSignal = await client
    .from('platform_feed_items')
    .update({
      evidence_item_id: evidenceInsert.data.id,
    })
    .eq('id', row.id);
  if (finalizeSignal.error) throw new Error(finalizeSignal.error.message);
}

/**
 * Resolves the profile_id used when minting oracle_evidence_items from
 * incoming signals. Restricted to privileged roles (operator/counsel/admin)
 * — falling back to an arbitrary charter user would silently attribute
 * service-minted evidence to a non-privileged account.
 */
async function resolveEvidenceProfileId(): Promise<string> {
  const client = getServiceClient();
  const roles = await client
    .from('charter_user_roles')
    .select('user_id, role')
    .in('role', ['operator', 'counsel', 'admin'])
    .limit(1)
    .maybeSingle();
  if (roles.error) {
    throw new Error(roles.error.message);
  }
  if (!roles.data?.user_id) {
    throw new Error(
      'Unable to resolve evidence profile_id: no operator/counsel/admin role exists in charter_user_roles',
    );
  }
  return roles.data.user_id as string;
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'r2-signal-process');
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    // JWT path: same idempotency contract as other write edge functions.
    // Trusted x-r2-signal-process-token callers (e.g. pg_cron) skip this header.
    if (!resolveTrustedProcessCaller(req)) {
      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;
      const auth = await guardAuth(req);
      if (!auth.ok) return auth.response;
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;
    }

    const client = getServiceClient();
    const limit = parseBatchLimit(req);
    const batchStarted = performance.now();
    const claim = await client.rpc('claim_platform_feed_items', { p_limit: limit });
    if (claim.error) {
      log.error('signal_process_claim_failed', {
        event: 'signal_process_claim_failed',
        message: claim.error.message,
        batch_limit: limit,
        duration_ms: Math.round(performance.now() - batchStarted),
      });
      return errorResponse(claim.error.message, 500);
    }

    const rows = (claim.data ?? []) as FeedRow[];
    if (rows.length === 0) {
      log.info('signal_process_batch', {
        event: 'signal_process_batch',
        claimed: 0,
        processed: 0,
        failed: 0,
        duration_ms: Math.round(performance.now() - batchStarted),
        batch_limit: limit,
      });
      return jsonResponse({ claimed: 0, processed: 0, failed: 0 });
    }

    let evidenceProfileId: string;
    try {
      evidenceProfileId = await resolveEvidenceProfileId();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to resolve evidence profile_id';
      for (const row of rows) {
        await markSignalFailed(row.id, message);
      }
      log.error('signal_process_batch', {
        event: 'signal_process_batch',
        claimed: rows.length,
        processed: 0,
        failed: rows.length,
        duration_ms: Math.round(performance.now() - batchStarted),
        batch_limit: limit,
        error: message,
      });
      return errorResponse(message, 500);
    }

    const policies = await loadSignalConfidencePolicies(client);
    let processed = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        let rowReady = await ensureActorMegEntityLinked(client, row);
        rowReady = await ensureRelatedMegEntitiesLinked(client, rowReady);
        await linkKbFourPortfolioAnchor(client, toFeedRowForMeg(rowReady));
        await maybeRecordCoffeePairingEdge(client, rowReady);
        await syncCoffeeMatchesMegIds(client, rowReady);
        await maybeApplyAutonomyFeedbackCalibration(client, rowReady, policies);
        if (await maybeProcessEntitySyncSignal(client, rowReady, policies)) {
          processed += 1;
          continue;
        }
        const autonomy = evaluateAutonomy(rowReady, policies);
        if (autonomy.decision !== 'auto_publish') {
          await persistAutonomyDecision(client, rowReady.id, autonomy, 'scored');
          processed += 1;
          continue;
        }
        await processOneSignal(rowReady, evidenceProfileId, autonomy);
        processed += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : 'Unknown processing error';
        await markSignalFailed(row.id, message);
      }
    }

    const durationMs = Math.round(performance.now() - batchStarted);
    log.info('signal_process_batch', {
      event: 'signal_process_batch',
      claimed: rows.length,
      processed,
      failed,
      duration_ms: durationMs,
      batch_limit: limit,
    });

    return jsonResponse({ claimed: rows.length, processed, failed });
  }),
);
