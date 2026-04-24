import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

// Explicit `asset_registry` projection (the charter-owned governance table
// with review / provenance columns).
const ASSET_REGISTRY_SELECT_COLUMNS =
  'asset_kind,asset_subtype,canonical_ecosystem_id,charter_entity_id,created_at,domain,governance_status,id,kind,label,lifecycle_status,local_record_id,local_table,manager_entity_id,metadata,owner_entity_id,provenance_captured_at,provenance_source_system,provenance_source_type,provenance_source_url,r2chart_governed_asset_id,ref_id,review_notes,review_status,reviewed_at,reviewed_by,updated_at,user_id';

// The `links` branch writes to `r2_core_asset_evidence_links` (columns
// `from_asset_id, to_asset_id, link_kind, confidence, metadata, id,
// created_at`). Earlier versions of this file referenced a non-existent
// `asset_evidence_links` (plural, no prefix) table — every call 404'd at
// runtime. See PR #171-ish follow-up.
const EVIDENCE_LINKS_TABLE = 'r2_core_asset_evidence_links';
const EVIDENCE_LINKS_SELECT_COLUMNS =
  'confidence,created_at,from_asset_id,id,link_kind,metadata,to_asset_id';

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') {
      return corsResponse();
    }

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    try {
      const url = new URL(req.url);
      const table = url.searchParams.get('table') ?? 'assets';
      const assetId = url.searchParams.get('id');

      const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

      if (table === 'links') {
        // ── Evidence Links ─────────────────────────────────────────────
        if (req.method === 'GET') {
          const fromAssetId = url.searchParams.get('from_asset_id');
          const toAssetId = url.searchParams.get('to_asset_id');
          const linkKind = url.searchParams.get('link_kind');

          let query = client.from(EVIDENCE_LINKS_TABLE).select(EVIDENCE_LINKS_SELECT_COLUMNS);

          if (fromAssetId) query = query.eq('from_asset_id', fromAssetId);
          if (toAssetId) query = query.eq('to_asset_id', toAssetId);
          if (linkKind) query = query.eq('link_kind', linkKind);

          const { data, error } = await query;

          if (error) {
            return errorResponse(error.message, 400);
          }

          return jsonResponse(data);
        } else if (req.method === 'POST') {
          const roleCheck = await requireRole(auth.claims.userId, 'operator');
          if (!roleCheck.ok) return roleCheck.response;
          const idemError = requireIdempotencyKey(req);
          if (idemError) return idemError;
          const body = await req.json();

          const { data, error } = await client
            .from(EVIDENCE_LINKS_TABLE)
            .insert([body])
            .select()
            .single();

          if (error) {
            return errorResponse(error.message, 400);
          }

          return jsonResponse(data, 201);
        } else if (req.method === 'DELETE') {
          const roleCheck = await requireRole(auth.claims.userId, 'operator');
          if (!roleCheck.ok) return roleCheck.response;
          const idemError = requireIdempotencyKey(req);
          if (idemError) return idemError;
          const linkId = url.searchParams.get('id');
          if (!linkId) {
            return errorResponse('id required as query param', 400);
          }

          const { error } = await client.from(EVIDENCE_LINKS_TABLE).delete().eq('id', linkId);

          if (error) {
            return errorResponse(error.message, 400);
          }

          return jsonResponse({ deleted: true });
        } else {
          return errorResponse('Method not allowed', 405);
        }
      } else {
        // ── Asset Registry ─────────────────────────────────────────────
        if (req.method === 'GET') {
          if (assetId) {
            const { data, error } = await client
              .from('asset_registry')
              .select(ASSET_REGISTRY_SELECT_COLUMNS)
              .eq('id', assetId)
              .single();

            if (error) {
              return errorResponse(error.message, 404);
            }

            return jsonResponse(data);
          } else {
            const kind = url.searchParams.get('kind');
            const domain = url.searchParams.get('domain');
            const refId = url.searchParams.get('ref_id');

            let query = client.from('asset_registry').select(ASSET_REGISTRY_SELECT_COLUMNS);

            if (kind) query = query.eq('kind', kind);
            if (domain) query = query.eq('domain', domain);
            if (refId) query = query.eq('ref_id', refId);

            const { data, error } = await query;

            if (error) {
              return errorResponse(error.message, 400);
            }

            return jsonResponse(data);
          }
        } else if (req.method === 'POST') {
          const roleCheck = await requireRole(auth.claims.userId, 'operator');
          if (!roleCheck.ok) return roleCheck.response;
          const idemError = requireIdempotencyKey(req);
          if (idemError) return idemError;
          const body = await req.json();

          const { data, error } = await client
            .from('asset_registry')
            .insert([body])
            .select()
            .single();

          if (error) {
            return errorResponse(error.message, 400);
          }

          return jsonResponse(data, 201);
        } else {
          return errorResponse('Method not allowed', 405);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return errorResponse(message, 500);
    }
  }),
);
