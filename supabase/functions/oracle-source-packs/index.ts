import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

Deno.serve(
  withRequestMeta(async (req) => {
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
            .select('created_at,id,metadata,profile_id,source_ids,source_lane,updated_at')
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

          let query = client
            .from('oracle_source_packs')
            .select('created_at,id,metadata,profile_id,source_ids,source_lane,updated_at');

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
        const { data, error } = await client
          .from('oracle_source_packs')
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return errorResponse(message, 500);
    }
  }),
);
