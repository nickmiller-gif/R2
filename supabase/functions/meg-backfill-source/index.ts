import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { extractBearerToken } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { timingSafeEqual } from '../_shared/signal-utils.ts';
import { withLogger } from '../_shared/log.ts';

type BackfillArgs = {
  source_system: string;
  source_table: string;
  batch_size?: number;
  dry_run?: boolean;
  cursor?: string | null;
  max_batches?: number;
};

const MAX_BODY = 256 * 1024;

function requireBackfillAuth(req: Request): Response | null {
  const expected = Deno.env.get('MEG_BACKFILL_BEARER')?.trim();
  if (!expected) {
    return errorResponse('MEG_BACKFILL_BEARER is not configured on the edge runtime', 503);
  }
  const bearer = extractBearerToken(req);
  if (!bearer || !timingSafeEqual(bearer, expected)) {
    return errorResponse('Unauthorized', 401);
  }
  return null;
}

type SourceRow = { id: string; title: string | null; meg_entity_id: string | null };

async function fetchOracleThesesBatch(
  client: ReturnType<typeof getServiceClient>,
  cursor: string | null,
  batch: number,
): Promise<SourceRow[]> {
  let q = client
    .from('oracle_theses')
    .select('id,title,meg_entity_id')
    .is('meg_entity_id', null)
    .order('id', { ascending: true })
    .limit(batch);
  if (cursor) {
    q = q.gt('id', cursor);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as SourceRow[];
}

function mapOracleThesisRow(row: SourceRow) {
  return {
    entity_type: 'meg:thesis',
    payload: {
      thesis_id: row.id,
      title: row.title,
      domain: null,
      confidence: null,
      publication_status: null,
    },
    dedup_email: null as string | null,
    external_id: row.id,
    source_row_id: row.id,
    canonical_name: row.title?.trim() || `thesis ${row.id}`,
  };
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'meg-backfill-source');

    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const authErr = requireBackfillAuth(req);
    if (authErr) return authErr;

    const raw = await req.text();
    if (raw.length > MAX_BODY) return errorResponse('Body too large', 413);

    let args: BackfillArgs;
    try {
      args = JSON.parse(raw) as BackfillArgs;
    } catch {
      return errorResponse('Invalid JSON', 400);
    }

    if (!args.source_system || !args.source_table) {
      return errorResponse('source_system and source_table are required', 400);
    }

    const batch = Math.min(Math.max(args.batch_size ?? 500, 1), 5000);
    const maxBatches = Math.min(Math.max(args.max_batches ?? 1, 1), 500);
    const dry = Boolean(args.dry_run);

    const client =
      getServiceClient() as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient;

    const { data: runRow, error: runInsErr } = await client
      .from('meg_backfill_runs')
      .insert({
        source_system: args.source_system,
        source_table: args.source_table,
        dry_run: dry,
      })
      .select('id')
      .single();

    if (runInsErr || !runRow?.id) {
      log.error('failed to open meg_backfill_runs row', { message: runInsErr?.message });
      return errorResponse(runInsErr?.message ?? 'run insert failed', 500);
    }

    const runId = runRow.id as string;
    let cursor = args.cursor ?? null;
    let scanned = 0;
    let matched = 0;
    let inserted = 0;
    let errors = 0;

    const key = `${args.source_system}:${args.source_table}`;

    for (let b = 0; b < maxBatches; b += 1) {
      let rows: SourceRow[] = [];
      try {
        if (key === 'r2:oracle_theses') {
          rows = await fetchOracleThesesBatch(client, cursor, batch);
        } else {
          log.warn('no adapter for source pair — no rows fetched', { key });
          break;
        }
      } catch (e) {
        log.error('fetchBatch failed', { key, err: String(e) });
        errors += 1;
        break;
      }

      if (rows.length === 0) break;
      cursor = rows[rows.length - 1]!.id;

      for (const row of rows) {
        scanned += 1;
        try {
          const mapped = mapOracleThesisRow(row);

          if (dry) {
            const ext = mapped.external_id;
            if (ext) {
              const { data: hits } = await client
                .from('meg_entities')
                .select('id,metadata')
                .eq('status', 'active')
                .contains('external_ids', { canonical_external_id: ext });
              const hit = (hits ?? []).find(
                (r) =>
                  (r.metadata as Record<string, string> | null)?.meg_catalog_entity_type ===
                  mapped.entity_type,
              );
              if (hit) matched += 1;
              else inserted += 1;
            } else {
              inserted += 1;
            }
            continue;
          }

          const { data: megId, error: rpcErr } = await client.rpc('meg_resolve_or_create', {
            p_entity_type: mapped.entity_type,
            p_canonical_name: mapped.canonical_name,
            p_canonical_email: mapped.dedup_email,
            p_canonical_external_id: mapped.external_id,
            p_source_system: args.source_system,
            p_source_table: args.source_table,
            p_source_row_id: mapped.source_row_id,
            p_payload: mapped.payload,
          });

          if (rpcErr || !megId) {
            throw new Error(rpcErr?.message ?? 'meg_resolve_or_create returned empty');
          }

          const { error: sideErr } = await client.rpc('meg_upsert_thesis_sidecar', {
            p_entity_id: megId,
            p_source_system: args.source_system,
            p_payload: mapped.payload,
          });
          if (sideErr) throw new Error(sideErr.message);

          const { error: updErr } = await client
            .from('oracle_theses')
            .update({ meg_entity_id: megId })
            .eq('id', row.id);
          if (updErr) throw new Error(updErr.message);

          const { count, error: cntErr } = await client
            .from('meg_entity_source_refs')
            .select('id', { count: 'exact', head: true })
            .eq('meg_entity_id', megId as string);
          if (cntErr) throw new Error(cntErr.message);
          if ((count ?? 0) > 1) matched += 1;
          else inserted += 1;
        } catch (e) {
          errors += 1;
          log.error('row backfill error', { row_id: row.id, err: String(e) });
        }
      }
    }

    const status =
      errors === 0 ? 'completed' : scanned === 0 && errors > 0 ? 'failed' : 'completed_with_errors';

    await client
      .from('meg_backfill_runs')
      .update({
        finished_at: new Date().toISOString(),
        status,
        scanned,
        matched_existing: matched,
        inserted_new: inserted,
        errors,
        notes: cursor ? `next_cursor=${cursor}` : 'exhausted',
      })
      .eq('id', runId);

    return jsonResponse({
      run_id: runId,
      scanned,
      matched,
      inserted,
      errors,
      next_cursor: cursor,
    });
  }),
);
