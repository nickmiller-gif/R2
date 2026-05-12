/**
 * Thin HTTP bridge for external apps (e.g. Lovable IP Pulse) to resolve or mint
 * rows in Eigen `public.meg_entities` via `meg_resolve_or_create`.
 *
 * **Canonical registry:** R2 (Eigen) only — not CentralR2 Tower. Tower’s
 * `resolve_meg_identity` RPC is a different database and contract; do not point
 * `TOWER_MEG_RESOLVER_*` style env vars at Tower for spine-aligned UUIDs.
 *
 * **Auth:** Set secret `MEG_RESOLVE_BRIDGE_TOKEN` on this function. Callers send
 * `Authorization: Bearer <token>`. Prefer this scoped token over the Eigen
 * service-role JWT in third-party hosts ([Pitfall A1, A3]).
 *
 * **Gateway:** Deploy with `verify_jwt = false` for this function (same pattern
 * as `r2-signal-ingest` / ADR-0003); all access control is the bridge token.
 *
 * @see docs/meg-resolve-bridge.md
 */
import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { extractBearerToken } from '../_shared/auth.ts';
import { timingSafeEqual } from '../_shared/signal-utils.ts';

const MAX_BODY_BYTES = 32 * 1024;

function authorizeBridge(req: Request): 'ok' | 'missing_secret' | 'unauthorized' {
  const configured = Deno.env.get('MEG_RESOLVE_BRIDGE_TOKEN')?.trim();
  if (!configured) return 'missing_secret';
  const bearer = extractBearerToken(req)?.trim() ?? '';
  if (!bearer) return 'unauthorized';
  if (timingSafeEqual(bearer, configured)) return 'ok';
  return 'unauthorized';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Map Lovable `kind` / short names to meg-catalog `p_entity_type` strings. */
function normalizeCatalogEntityType(kind: unknown): string {
  const raw = typeof kind === 'string' ? kind.trim() : '';
  if (!raw) return 'meg:topic';
  if (raw.startsWith('meg:')) return raw.slice(0, 64);
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const mapped = `meg:${slug || 'topic'}`;
  return mapped.slice(0, 64);
}

function slugKey(sourcePlatform: string, externalId: string): string {
  return `${sourcePlatform}_${externalId}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 200);
}

function buildCanonicalExternalId(
  entityType: string,
  sourcePlatform: string,
  externalId: string,
): string {
  const slug = slugKey(sourcePlatform, externalId);
  const base = `${entityType}:${slug}`;
  return base.slice(0, 256);
}

function safeString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'meg-resolve-bridge');
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const auth = authorizeBridge(req);
    if (auth === 'missing_secret') {
      return errorResponse('MEG_RESOLVE_BRIDGE_TOKEN not configured on function', 503);
    }
    if (auth !== 'ok') {
      return errorResponse('Unauthorized', 401);
    }

    const len = req.headers.get('content-length');
    if (len && Number.parseInt(len, 10) > MAX_BODY_BYTES) {
      return errorResponse('Payload too large', 413);
    }

    let raw: unknown;
    try {
      const text = await req.text();
      if (text.length > MAX_BODY_BYTES) return errorResponse('Payload too large', 413);
      raw = JSON.parse(text);
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    if (!isRecord(raw)) return errorResponse('Body must be a JSON object', 400);

    const source_platform = safeString(raw.source_platform, 64);
    const external_id = safeString(raw.external_id, 256);
    if (!source_platform) return errorResponse('source_platform required', 400);
    if (!external_id) return errorResponse('external_id required', 400);

    const kind = raw.kind;
    const hints = isRecord(raw.hints) ? raw.hints : {};

    const entityType = normalizeCatalogEntityType(kind);
    const overrideExt =
      safeString(hints.meg_canonical_id, 256) ?? safeString(hints.canonical_external_id, 256);
    const canonical_external_id =
      overrideExt ?? buildCanonicalExternalId(entityType, source_platform, external_id);

    const title = safeString(hints.title, 500) ?? safeString(hints.display_name, 500);
    const p_canonical_name = title ?? `${source_platform} ${external_id}`.slice(0, 500);

    const email = safeString(hints.email, 320) ?? safeString(hints.canonical_email, 320);
    const source_table = safeString(hints.source_table, 96) ?? 'external_bridge';
    const source_row_id = safeString(hints.source_row_id, 256) ?? external_id;

    const payload: Record<string, unknown> = {
      bridge: 'meg-resolve-bridge@v1',
      source_platform,
      external_id,
      hints,
    };

    const client = getServiceClient();
    // supabase-js Database generics are not wired for Edge `deno check`; mirror meg-backfill-source.
    const { data: megEntityId, error: rpcErr } = await (client as any).rpc(
      'meg_resolve_or_create',
      {
        p_entity_type: entityType,
        p_canonical_name,
        p_canonical_email: email ?? undefined,
        p_canonical_external_id: canonical_external_id,
        p_source_system: source_platform,
        p_source_table: source_table,
        p_source_row_id: source_row_id,
        p_payload: payload,
      },
    );

    if (rpcErr) {
      log.error('meg_resolve_failed', {
        event: 'meg_resolve_failed',
        message: rpcErr.message,
        source_platform,
        external_id,
      });
      return errorResponse(rpcErr.message, 500);
    }
    if (!megEntityId || typeof megEntityId !== 'string') {
      return errorResponse('meg_resolve_or_create returned empty', 500);
    }

    const { data: row, error: rowErr } = await (client as any)
      .from('meg_entities')
      .select('id, external_ids')
      .eq('id', megEntityId)
      .maybeSingle();

    if (rowErr) {
      log.warn('meg_entity_fetch_failed', { message: rowErr.message, meg_entity_id: megEntityId });
    }

    const rowTyped = row as { id?: string; external_ids?: unknown } | null;
    const extIds =
      rowTyped?.external_ids && isRecord(rowTyped.external_ids) ? rowTyped.external_ids : {};
    const meg_canonical_id =
      typeof extIds.canonical_external_id === 'string' && extIds.canonical_external_id.trim()
        ? extIds.canonical_external_id.trim()
        : canonical_external_id;

    log.info('meg_resolve_ok', {
      event: 'meg_resolve_ok',
      source_platform,
      external_id,
      meg_entity_id: megEntityId,
    });

    return jsonResponse({
      meg_canonical_id,
      meg_entity_id: megEntityId,
      resolution: 'tower',
    });
  }),
);
