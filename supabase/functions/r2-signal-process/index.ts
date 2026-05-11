import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { buildChunks, embedTexts, sha256Hex } from '../_shared/eigen.ts';
import { computeNextRetryAt, inferSignalPolicyTags } from '../_shared/signal-utils.ts';
import {
  inferActorMegResolveArgs,
  inferRelatedMegResolveArgsList,
  isCoffeePairingSignal,
  isUuid,
  pickCoffeeMatchTargetMegEntityId,
} from '../_shared/meg-resolve-signal.ts';

const SERVICE_ROLE_OWNER_ID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_BATCH_LIMIT = 15;
/** Hard cap per invocation; matches cron `limit=` and claim RPC backpressure. */
const MAX_BATCH_LIMIT = 25;
/** Must match `max_attempts` in `claim_platform_feed_items` (signal_contract migrations). */
const MAX_SIGNAL_PROCESS_ATTEMPTS = 10;

/** True when `x-r2-signal-process-token` matches configured `R2_SIGNAL_PROCESS_TOKEN`. */
function resolveTrustedProcessCaller(req: Request): boolean {
  const configured = Deno.env.get('R2_SIGNAL_PROCESS_TOKEN')?.trim();
  if (!configured) return false;
  const provided = req.headers.get('x-r2-signal-process-token')?.trim();
  return Boolean(provided && provided === configured);
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
  summary: string;
  payload: Record<string, unknown>;
  confidence: number | null;
  privacy_level: 'public' | 'members' | 'operator' | 'private';
  event_time: string;
  related_entity_ids: string[];
  routing_targets: string[];
  actor_meg_entity_id?: string | null;
};

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

  const { data: megId, error } = await client.rpc('meg_resolve_or_create', args);
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

  for (const args of inferred) {
    const { data: megId, error } = await client.rpc('meg_resolve_or_create', args);
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
  if (sameMembers && inferred.length === 0) {
    return row;
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

/** Records a `coffee_pairing` MEG edge when the signal is a coffee-match pairing. */
async function maybeRecordCoffeePairingEdge(
  client: ReturnType<typeof getServiceClient>,
  row: FeedRow,
): Promise<void> {
  if (!isCoffeePairingSignal(row)) return;
  const actorId = row.actor_meg_entity_id;
  if (!actorId || !isUuid(actorId)) return;
  const target = pickCoffeeMatchTargetMegEntityId(actorId, row.related_entity_ids ?? []);
  if (!target) return;

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

  const target = pickCoffeeMatchTargetMegEntityId(actorId, row.related_entity_ids ?? []);
  const upd: { actor_meg_entity_id: string; matched_meg_entity_id?: string | null } = {
    actor_meg_entity_id: actorId,
  };
  if (target && isUuid(target)) {
    upd.matched_meg_entity_id = target;
  }

  const { error } = await client.from('coffee_matches').update(upd).eq('id', matchId);
  if (error) {
    throw new Error(`coffee_matches MEG sync: ${error.message}`);
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

/** Chunks signal content, embeds, writes document + ingestion run + evidence, marks published. */
async function processOneSignal(row: FeedRow, evidenceProfileId: string): Promise<void> {
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

  const finalizeSignal = await client
    .from('platform_feed_items')
    .update({
      evidence_item_id: evidenceInsert.data.id,
      processing_status: 'published',
      error: null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', row.id);
  if (finalizeSignal.error) {
    throw new Error(finalizeSignal.error.message);
  }
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

    let processed = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        let rowReady = await ensureActorMegEntityLinked(client, row);
        rowReady = await ensureRelatedMegEntitiesLinked(client, rowReady);
        await maybeRecordCoffeePairingEdge(client, rowReady);
        await syncCoffeeMatchesMegIds(client, rowReady);
        await processOneSignal(rowReady, evidenceProfileId);
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
