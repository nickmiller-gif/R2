import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { sanitizeInsert } from '../_shared/sanitize.ts';

// profile_id is bound to the authenticated user server-side so an operator
// can never create a pack attributed to someone else's profile.
const INSERT_FIELDS = ['source_lane', 'source_ids', 'metadata'] as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const packId = url.searchParams.get('id');

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (packId) {
        // GET single source pack
        const { data, error } = await client
          .from('oracle_source_packs')
          .select('*')
          .eq('id', packId)
          .single();

        if (error) {
          return errorResponse(error.message, 404);
        }

        return jsonResponse(data);
      } else {
        // GET list with optional filters
        const profileId = url.searchParams.get('profile_id');
        const sourceLane = url.searchParams.get('source_lane');

        let query = client.from('oracle_source_packs').select('*');

        if (profileId) query = query.eq('profile_id', profileId);
        if (sourceLane) query = query.eq('source_lane', sourceLane);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      // CREATE source pack
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;
      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      const body = await req.json();
      const row = sanitizeInsert(body, INSERT_FIELDS, {
        profile_id: auth.claims.userId,
      });
      const { data, error } = await client
        .from('oracle_source_packs')
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
