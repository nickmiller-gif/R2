import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { pickFields } from '../_shared/sanitize.ts';

const ASSET_REGISTRY_INSERT_FIELDS = ['kind', 'ref_id', 'domain', 'label', 'metadata'] as const;
const EVIDENCE_LINK_INSERT_FIELDS = ['from_asset_id', 'to_asset_id', 'link_kind', 'confidence', 'metadata'] as const;

Deno.serve(async (req) => {
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

        let query = client.from('asset_evidence_links').select('*');

        if (fromAssetId) query = query.eq('from_asset_id', fromAssetId);
        if (toAssetId) query = query.eq('to_asset_id', toAssetId);
        if (linkKind) query = query.eq('link_kind', linkKind);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      } else if (req.method === 'POST') {
        const roleCheck = await requireRole(auth.claims.userId, 'operator'); if (!roleCheck.ok) return roleCheck.response;
        const idemError = requireIdempotencyKey(req); if (idemError) return idemError;
        const body = await req.json();

        const row = pickFields(body, EVIDENCE_LINK_INSERT_FIELDS);
        const { data, error } = await client
          .from('asset_evidence_links')
          .insert([row])
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data, 201);
      } else if (req.method === 'DELETE') {
        const roleCheck = await requireRole(auth.claims.userId, 'operator'); if (!roleCheck.ok) return roleCheck.response;
        const idemError = requireIdempotencyKey(req); if (idemError) return idemError;
        const linkId = url.searchParams.get('id');
        if (!linkId) {
          return errorResponse('id required as query param', 400);
        }

        const { error } = await client
          .from('asset_evidence_links')
          .delete()
          .eq('id', linkId);

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
            .select('*')
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

          let query = client.from('asset_registry').select('*');

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
        const roleCheck = await requireRole(auth.claims.userId, 'operator'); if (!roleCheck.ok) return roleCheck.response;
        const idemError = requireIdempotencyKey(req); if (idemError) return idemError;
        const body = await req.json();

        const row = pickFields(body, ASSET_REGISTRY_INSERT_FIELDS);
        const { data, error } = await client
          .from('asset_registry')
          .insert([row])
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
});
