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
      const pathname = url.pathname;
      const segments = pathname.split('/').filter(Boolean);
      const id =
        segments[segments.length - 1] === 'charter-payouts' ? null : segments[segments.length - 1];
      const action = segments[segments.length - 1] === 'approve' ? 'approve' : null;

      const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

      if (req.method === 'GET') {
        if (id) {
          // GET single payout
          const { data, error } = await client
            .from('charter_payouts')
            .select(
              'amount,approved_by,confidence,created_at,created_by,currency,entity_id,id,obligation_id,payout_date,reviewed_by,right_id,status,updated_at',
            )
            .eq('id', id)
            .single();

          if (error) {
            return errorResponse(error.message, 404);
          }

          return jsonResponse(data);
        } else {
          // GET list with optional filters
          const entityId = url.searchParams.get('entity_id');
          const status = url.searchParams.get('status');

          let query = client
            .from('charter_payouts')
            .select(
              'amount,approved_by,confidence,created_at,created_by,currency,entity_id,id,obligation_id,payout_date,reviewed_by,right_id,status,updated_at',
            );

          if (entityId) query = query.eq('entity_id', entityId);
          if (status) query = query.eq('status', status);

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

        // Check if this is an approve action
        if (action === 'approve') {
          const body = await req.json();
          const payoutId = body.id;
          const approvedBy = body.approvedBy;

          if (!payoutId || !approvedBy) {
            return errorResponse('id and approvedBy required', 400);
          }

          const { data, error } = await client
            .from('charter_payouts')
            .update({
              status: 'approved',
              approved_by: approvedBy,
              updated_at: new Date().toISOString(),
            })
            .eq('id', payoutId)
            .select()
            .single();

          if (error) {
            return errorResponse(error.message, 400);
          }

          return jsonResponse(data);
        }

        // CREATE payout
        const body = await req.json();
        const { data, error } = await client
          .from('charter_payouts')
          .insert([body])
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data, 201);
      } else if (req.method === 'PATCH') {
        // UPDATE payout
        const roleCheck = await requireRole(auth.claims.userId, 'operator');
        if (!roleCheck.ok) return roleCheck.response;

        const idemError = requireIdempotencyKey(req);
        if (idemError) return idemError;

        const body = await req.json();
        const payoutId = body.id;

        if (!payoutId) {
          return errorResponse('id required in body', 400);
        }

        const { data, error } = await client
          .from('charter_payouts')
          .update(body)
          .eq('id', payoutId)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

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
