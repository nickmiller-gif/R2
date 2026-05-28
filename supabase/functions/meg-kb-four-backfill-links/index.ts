import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { extractBearerToken } from '../_shared/auth.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { timingSafeEqual } from '../_shared/signal-utils.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import {
  collectResolvedMegIdsFromRow,
  isKbFourSourceSystem,
  kbFourPortfolioAnchorResolveArgs,
  linkKbFourPortfolioAnchor,
} from '../_shared/meg-kb-four-linkage.ts';
import {
  inferRelatedMegResolveArgsList,
  sanitizeMegResolveRpcArgs,
  type FeedRowForMeg,
} from '../_shared/meg-resolve-signal.ts';

const KB_FOUR_SOURCES = [
  'centralr2',
  'operator_workbench',
  'r2_works',
  'r2chart',
  'continuity_nexus',
  'ip_pulse_point',
] as const;

function hasServiceToken(req: Request): boolean {
  const configured = Deno.env.get('MEG_BACKFILL_BEARER')?.trim() ?? '';
  if (!configured) return false;
  const supplied = extractBearerToken(req)?.trim() ?? '';
  return supplied.length > 0 && timingSafeEqual(supplied, configured);
}

type FeedRow = FeedRowForMeg & {
  ingested_at: string;
  processing_status: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveInferredRelatedIds(
  client: ReturnType<typeof getServiceClient>,
  row: FeedRow,
): Promise<string[]> {
  const merged = new Set(collectResolvedMegIdsFromRow(row));
  const inferred = inferRelatedMegResolveArgsList(row);
  for (const args of inferred) {
    const { data: megId, error } = await client.rpc(
      'meg_resolve_or_create',
      sanitizeMegResolveRpcArgs(args),
    );
    if (error) throw new Error(error.message);
    if (megId && isUuid(String(megId))) merged.add(String(megId));
  }
  return [...merged];
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'meg-kb-four-backfill-links');
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
    if (!hasServiceToken(req)) {
      const configured = Deno.env.get('MEG_BACKFILL_BEARER')?.trim();
      if (!configured) {
        return errorResponse('MEG_BACKFILL_BEARER is not configured on the edge runtime', 503);
      }
      return errorResponse('Unauthorized', 401);
    }

    let replay = true;
    let limit = 500;
    try {
      const raw = await req.text();
      if (raw.trim()) {
        const body = JSON.parse(raw) as { replay_processing?: boolean; limit?: number };
        if (body.replay_processing === false) replay = false;
        if (typeof body.limit === 'number' && body.limit > 0 && body.limit <= 2000) {
          limit = body.limit;
        }
      }
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const client = getServiceClient();
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await client
      .from('platform_feed_items')
      .select(
        'id,source_system,source_event_type,summary,payload,actor_meg_entity_id,related_entity_ids,ingested_at,processing_status',
      )
      .in('source_system', [...KB_FOUR_SOURCES])
      .gte('ingested_at', sinceIso)
      .order('ingested_at', { ascending: false })
      .limit(limit);
    if (error) return errorResponse(error.message, 500);

    const SMOKE_TYPES = new Set(['kb_four_smoke', 'stream_a_closeout', 'r2.signal.ingest.probe']);
    const rows = ((data ?? []) as FeedRow[]).filter((r) => !SMOKE_TYPES.has(r.source_event_type));
    let linked_rows = 0;
    let replayed = 0;
    let related_updated = 0;
    const anchorArgs = kbFourPortfolioAnchorResolveArgs('kb-four-backfill-batch');
    const { data: anchorId, error: anchorErr } = await client.rpc(
      'meg_resolve_or_create',
      sanitizeMegResolveRpcArgs(anchorArgs),
    );
    if (anchorErr) return errorResponse(anchorErr.message, 500);

    for (const row of rows) {
      if (!isKbFourSourceSystem(row.source_system)) continue;
      const feedRow: FeedRowForMeg = {
        id: row.id,
        source_system: row.source_system,
        source_event_type: row.source_event_type,
        summary: row.summary,
        payload: (row.payload ?? {}) as Record<string, unknown>,
        actor_meg_entity_id: row.actor_meg_entity_id,
        related_entity_ids: row.related_entity_ids,
      };

      const resolved = await resolveInferredRelatedIds(client, { ...feedRow, ...row });
      const existing = new Set(
        (row.related_entity_ids ?? []).filter((id): id is string => typeof id === 'string'),
      );
      const nextRelated = [...new Set([...existing, ...resolved])];
      if (nextRelated.length > existing.size) {
        const upd = await client
          .from('platform_feed_items')
          .update({ related_entity_ids: nextRelated })
          .eq('id', row.id);
        if (upd.error) return errorResponse(upd.error.message, 500);
        related_updated += 1;
        feedRow.related_entity_ids = nextRelated;
      }

      feedRow.related_entity_ids = [...new Set([...nextRelated, anchorId as string])];
      await linkKbFourPortfolioAnchor(client, feedRow);
      linked_rows += 1;

      if (replay) {
        const enqueue = await client.rpc('enqueue_platform_feed_processing', {
          signal_id: row.id,
        });
        if (enqueue.error) {
          log.error('replay_enqueue_failed', { id: row.id, message: enqueue.error.message });
        } else {
          replayed += 1;
        }
      }
    }

    log.info('meg_kb_four_backfill_complete', {
      scanned: rows.length,
      linked_rows,
      related_updated,
      replayed,
      anchor_id: anchorId,
    });

    return jsonResponse({
      ok: true,
      scanned: rows.length,
      linked_rows,
      related_updated,
      replayed,
      portfolio_anchor_id: anchorId,
    });
  }),
);
