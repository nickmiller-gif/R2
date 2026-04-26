import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { buildChunks, embedTexts, sha256Hex } from '../_shared/eigen.ts';
import { computeNextRetryAt, inferSignalPolicyTags } from '../_shared/signal-utils.ts';

const SERVICE_ROLE_OWNER_ID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_BATCH_LIMIT = 15;

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
};

function resolveTrustedProcessCaller(req: Request): boolean {
  const configured = Deno.env.get('R2_SIGNAL_PROCESS_TOKEN')?.trim();
  if (!configured) return false;
  const provided = req.headers.get('x-r2-signal-process-token')?.trim();
  return Boolean(provided && provided === configured);
}

function parseBatchLimit(req: Request): number {
  const url = new URL(req.url);
  const raw =
    url.searchParams.get('limit') ??
    Deno.env.get('R2_SIGNAL_PROCESS_BATCH_LIMIT') ??
    String(DEFAULT_BATCH_LIMIT);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_BATCH_LIMIT;
  return Math.min(parsed, 50);
}

async function markSignalFailed(signalId: string, message: string): Promise<void> {
  const client = getServiceClient();
  const nextRetryAt = computeNextRetryAt();
  await client
    .from('platform_feed_items')
    .update({
      processing_status: 'failed',
      error: message.slice(0, 2000),
      next_retry_at: nextRetryAt,
      processed_at: new Date().toISOString(),
    })
    .eq('id', signalId);
}

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
  const chunkRows = chunks.map((chunk, idx) => ({
    document_id: documentId,
    chunk_level: chunk.chunkLevel,
    heading_path: chunk.headingPath,
    entity_ids: row.related_entity_ids,
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

async function resolveEvidenceProfileId(): Promise<string> {
  const client = getServiceClient();
  const roles = await client
    .from('charter_user_roles')
    .select('user_id, role')
    .in('role', ['operator', 'counsel', 'admin'])
    .limit(1)
    .maybeSingle();
  if (!roles.error && roles.data?.user_id) {
    return roles.data.user_id as string;
  }

  const fallback = await client
    .from('charter_user_roles')
    .select('user_id')
    .limit(1)
    .maybeSingle();
  if (fallback.error || !fallback.data?.user_id) {
    throw new Error('Unable to resolve evidence profile_id from charter_user_roles');
  }
  return fallback.data.user_id as string;
}

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    if (!resolveTrustedProcessCaller(req)) {
      const auth = await guardAuth(req);
      if (!auth.ok) return auth.response;
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;
    }

    const client = getServiceClient();
    const limit = parseBatchLimit(req);
    const claim = await client.rpc('claim_platform_feed_items', { p_limit: limit });
    if (claim.error) return errorResponse(claim.error.message, 500);

    const rows = (claim.data ?? []) as FeedRow[];
    if (rows.length === 0) {
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
      return errorResponse(message, 500);
    }

    let processed = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await processOneSignal(row, evidenceProfileId);
        processed += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : 'Unknown processing error';
        await markSignalFailed(row.id, message);
      }
    }

    return jsonResponse({ claimed: rows.length, processed, failed });
  }),
);
