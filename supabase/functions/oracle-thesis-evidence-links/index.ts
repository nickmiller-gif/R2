import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const linkId = url.searchParams.get('id');

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      // GET list with optional filters
      const thesisId = url.searchParams.get('thesis_id');
      const evidenceItemId = url.searchParams.get('evidence_item_id');

      let query = client.from('oracle_thesis_evidence_links').select('*');

      if (thesisId) query = query.eq('thesis_id', thesisId);
      if (evidenceItemId) query = query.eq('evidence_item_id', evidenceItemId);

      const { data, error } = await query;

      if (error) {
        return errorResponse(error.message, 400);
      }

      return jsonResponse(data);
    } else if (req.method === 'POST') {
      // CREATE link
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;
      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      const body = await req.json();
      const { data, error } = await client
        .from('oracle_thesis_evidence_links')
        .insert([body])
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 400);
      }

      return jsonResponse(data, 201);
    } else if (req.method === 'DELETE') {
      // DELETE link
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;
      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      if (!linkId) {
        return errorResponse('id required in query params', 400);
      }

      const { error } = await client
        .from('oracle_thesis_evidence_links')
        .delete()
        .eq('id', linkId);

      if (error) {
        return errorResponse(error.message, 400);
      }

      return jsonResponse({ success: true });
    } else {
      return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
