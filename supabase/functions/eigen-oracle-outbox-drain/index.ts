/**
 * Drains eigen_oracle_outbox pending rows into oracle_signals and links knowledge_chunks.
 * Invoke with Authorization: Bearer <service_role JWT> (e.g. Supabase cron + service key).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';

type ConfidenceBand = 'high' | 'medium' | 'low';

function parseConfidence(value: unknown): ConfidenceBand {
  if (value === 'high' || value === 'low') return value;
  return 'medium';
}

function clampScore(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  return 52;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;
  if (auth.claims.role !== 'service_role') {
    return errorResponse('Service role JWT required', 403);
  }

  const limitRaw = new URL(req.url).searchParams.get('limit');
  const limit = Math.min(50, Math.max(1, Number.parseInt(limitRaw ?? '15', 10) || 15));

  const client = getServiceClient();
  const results: Array<Record<string, unknown>> = [];

  const pending = await client
    .from('eigen_oracle_outbox')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (pending.error) return errorResponse(pending.error.message, 400);
  const rows = pending.data ?? [];

  for (const row of rows) {
    const id = row.id as string;
    const claim = await client
      .from('eigen_oracle_outbox')
      .update({
        status: 'processing',
        claimed_at: new Date().toISOString(),
        claimed_by: 'eigen-oracle-outbox-drain',
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (claim.error) {
      results.push({ id, outcome: 'claim_error', error: claim.error.message });
      continue;
    }
    if (!claim.data) {
      results.push({ id, outcome: 'skipped', reason: 'already_claimed' });
      continue;
    }

    const eventType = String(row.event_type ?? '');
    if (eventType !== 'signal_candidate') {
      await client
        .from('eigen_oracle_outbox')
        .update({
          status: 'skipped',
          processed_at: new Date().toISOString(),
        })
        .eq('id', id);
      results.push({ id, outcome: 'skipped', reason: `event_type:${eventType}` });
      continue;
    }

    const payload = (row.payload && typeof row.payload === 'object')
      ? row.payload as Record<string, unknown>
      : {};
    const sourceDocumentId = row.source_document_id as string | null;
    const entityIds = Array.isArray(payload.entity_ids)
      ? payload.entity_ids.map((x) => String(x)).filter((x) => x.length > 0)
      : [];

    let entityAssetId: string | null = null;
    let signalAnchor: 'governance_entity' | 'document' | null = null;
    let assetLookupFailed = false;
    for (const refId of entityIds) {
      const asset = await client
        .from('asset_registry')
        .select('id')
        .eq('kind', 'governance_entity')
        .eq('ref_id', refId)
        .limit(1)
        .maybeSingle();
      if (asset.error) {
        await client
          .from('eigen_oracle_outbox')
          .update({ status: 'failed', processed_at: new Date().toISOString() })
          .eq('id', id);
        results.push({ id, outcome: 'failed', error: asset.error.message });
        assetLookupFailed = true;
        break;
      }
      if (asset.data?.id) {
        entityAssetId = asset.data.id as string;
        signalAnchor = 'governance_entity';
        break;
      }
    }

    if (assetLookupFailed) continue;

    if (!entityAssetId && sourceDocumentId) {
      const docAsset = await client
        .from('asset_registry')
        .select('id')
        .eq('kind', 'document')
        .eq('ref_id', sourceDocumentId)
        .limit(1)
        .maybeSingle();
      if (docAsset.error) {
        await client
          .from('eigen_oracle_outbox')
          .update({ status: 'failed', processed_at: new Date().toISOString() })
          .eq('id', id);
        results.push({ id, outcome: 'failed', error: docAsset.error.message });
        continue;
      }
      if (docAsset.data?.id) {
        entityAssetId = docAsset.data.id as string;
        signalAnchor = 'document';
      }
    }

    if (!entityAssetId) {
      await client
        .from('eigen_oracle_outbox')
        .update({
          status: 'skipped',
          processed_at: new Date().toISOString(),
        })
        .eq('id', id);
      results.push({
        id,
        outcome: 'skipped',
        reason:
          'no_asset_registry_target (need governance_entity for entity_ids or document row for source_document_id)',
      });
      continue;
    }

    const producerRef =
      signalAnchor === 'document'
        ? 'eigen_oracle_outbox:document:v1'
        : 'eigen_oracle_outbox:governance:v1';
    const reasons = Array.isArray(payload.reason_traces)
      ? payload.reason_traces.map((r) => String(r).slice(0, 2000))
      : [];
    const tags = Array.isArray(payload.tags) ? payload.tags.map((t) => String(t)) : [];
    const score = clampScore(payload.suggested_score);
    const confidence = parseConfidence(payload.confidence_band);

    const insert = await client
      .from('oracle_signals')
      .insert([
        {
          entity_asset_id: entityAssetId,
          score,
          confidence,
          reasons: reasons.length > 0 ? reasons : ['Eigen ingest signal_candidate'],
          tags,
          status: 'scored',
          analysis_document_id: sourceDocumentId,
          producer_ref: producerRef,
        },
      ])
      .select('id')
      .single();

    if (insert.error || !insert.data?.id) {
      await client
        .from('eigen_oracle_outbox')
        .update({ status: 'failed', processed_at: new Date().toISOString() })
        .eq('id', id);
      results.push({ id, outcome: 'failed', error: insert.error?.message ?? 'insert failed' });
      continue;
    }

    const signalId = insert.data.id as string;

    if (sourceDocumentId) {
      const chunkUp = await client
        .from('knowledge_chunks')
        .update({ oracle_signal_id: signalId, oracle_relevance_score: score })
        .eq('document_id', sourceDocumentId);
      if (chunkUp.error) {
        await client
          .from('eigen_oracle_outbox')
          .update({ status: 'failed', processed_at: new Date().toISOString() })
          .eq('id', id);
        results.push({ id, outcome: 'failed', error: chunkUp.error.message });
        continue;
      }
    }

    await client
      .from('eigen_oracle_outbox')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        oracle_signal_id: signalId,
      })
      .eq('id', id);

    results.push({ id, outcome: 'processed', oracle_signal_id: signalId });
  }

  const pendingHead = await client
    .from('eigen_oracle_outbox')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  const pendingRemaining = pendingHead.error ? null : (pendingHead.count ?? 0);

  return jsonResponse({
    examined: rows.length,
    results,
    pending_remaining: pendingRemaining,
  });
});
