import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    try {
      const url = new URL(req.url);
      const pathname = url.pathname;
      const segments = pathname.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      const id = lastSegment === 'charter-governance' ? null : lastSegment;
      const action = url.searchParams.get('action');

      const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

      if (req.method === 'GET') {
        if (id) {
          // GET single governance entity
          const { data, error } = await client
            .from('charter_governance_entities')
            .select(
              'body,created_at,created_by,id,kind,parent_id,ref_code,status,title,updated_at,version',
            )
            .eq('id', id)
            .single();
          if (error) return errorResponse(error.message, 404);
          return jsonResponse(data);
        } else {
          // GET list with optional filters
          const kind = url.searchParams.get('kind');
          const status = url.searchParams.get('status');
          const refCode = url.searchParams.get('ref_code');

          let query = client
            .from('charter_governance_entities')
            .select(
              'body,created_at,created_by,id,kind,parent_id,ref_code,status,title,updated_at,version',
            );
          if (kind) query = query.eq('kind', kind);
          if (status) query = query.eq('status', status);
          if (refCode) query = query.eq('ref_code', refCode);

          const { data, error } = await query;
          if (error) return errorResponse(error.message, 400);
          return jsonResponse(data);
        }
      } else if (req.method === 'POST') {
        const roleCheck = await requireRole(auth.claims.userId, 'operator');
        if (!roleCheck.ok) return roleCheck.response;

        const idemError = requireIdempotencyKey(req);
        if (idemError) return idemError;

        const body = await req.json();

        if (action === 'transition') {
          // TRANSITION governance entity status
          const { entityId, toStatus, reason, actorId } = body;
          if (!entityId || !toStatus || !actorId) {
            return errorResponse('entityId, toStatus, and actorId are required', 400);
          }

          // Fetch current entity to capture from_status
          const { data: entity, error: fetchError } = await client
            .from('charter_governance_entities')
            .select('status')
            .eq('id', entityId)
            .single();
          if (fetchError) return errorResponse(fetchError.message, 404);

          // Insert transition record (transitioned_at uses DB DEFAULT now())
          const { data: transition, error: transError } = await client
            .from('charter_governance_transitions')
            .insert([
              {
                entity_id: entityId,
                from_status: entity.status,
                to_status: toStatus,
                reason: reason ?? null,
                actor_id: actorId,
              },
            ])
            .select()
            .single();
          if (transError) return errorResponse(transError.message, 400);

          // Update entity status
          const { error: updateError } = await client
            .from('charter_governance_entities')
            .update({ status: toStatus, updated_at: new Date().toISOString() })
            .eq('id', entityId);
          if (updateError) return errorResponse(updateError.message, 400);

          return jsonResponse(transition);
        }

        // CREATE governance entity
        const { data, error } = await client
          .from('charter_governance_entities')
          .insert([body])
          .select()
          .single();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data, 201);
      } else if (req.method === 'PATCH') {
        // UPDATE governance entity
        const roleCheck = await requireRole(auth.claims.userId, 'operator');
        if (!roleCheck.ok) return roleCheck.response;

        const idemError = requireIdempotencyKey(req);
        if (idemError) return idemError;

        const body = await req.json();
        const entityId = body.id;
        if (!entityId) return errorResponse('id required in body', 400);

        const { data, error } = await client
          .from('charter_governance_entities')
          .update(body)
          .eq('id', entityId)
          .select()
          .single();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data);
      } else {
        return errorResponse('Method not allowed', 405);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return errorResponse(message, 500);
    }
  }),
);
