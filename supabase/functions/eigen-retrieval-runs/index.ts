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
    const action = url.searchParams.get('action');
    const runId = url.searchParams.get('id');

    if (req.method === 'GET') {
      if (runId) {
        // Rows are written from retrieve via the service-role client (RLS bypass on insert).
        // Reading by id with the caller-scoped client can yield zero rows under JWT/RLS drift
        // even for the same user who just ran eigen-chat; use the same RBAC bar as eigen-chat
        // (member) and read with the service client so receipts match persisted runs.
        const roleCheck = await requireRole(auth.claims.userId, 'member');
        if (!roleCheck.ok) return roleCheck.response;

        const svc = getServiceClient();
        const { data, error } = await svc
          .from('retrieval_runs')
          .select('*')
          .eq('id', runId)
          .maybeSingle();

        if (error) {
          return errorResponse(error.message, 400);
        }
        if (!data) {
          return errorResponse('Retrieval run not found', 404);
        }

        return jsonResponse(data);
      } else {
        const client = getSupabaseClient(req);
        const status = url.searchParams.get('status');

        let query = client.from('retrieval_runs').select('*');

        if (status) query = query.eq('status', status);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      const client = getServiceClient();
      const roleCheck = await requireRole(auth.claims.userId, 'operator'); if (!roleCheck.ok) return roleCheck.response;
      const idemError = requireIdempotencyKey(req); if (idemError) return idemError;
      const body = await req.json();

      if (action === 'complete') {
        const id = body.id;
        if (!id) {
          return errorResponse('id required in body', 400);
        }

        const { data, error } = await client
          .from('retrieval_runs')
          .update({
            status: 'completed',
            candidate_count: body.candidate_count,
            filtered_count: body.filtered_count,
            final_count: body.final_count,
            latency_ms: body.latency_ms,
          })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      } else if (action === 'fail') {
        const id = body.id;
        if (!id) {
          return errorResponse('id required in body', 400);
        }

        const { data, error } = await client
          .from('retrieval_runs')
          .update({
            status: 'failed',
            metadata: JSON.stringify({ failureReason: body.reason }),
          })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      } else {
        // CREATE run
        const { data, error } = await client
          .from('retrieval_runs')
          .insert([body])
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data, 201);
      }
    } else {
      return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
