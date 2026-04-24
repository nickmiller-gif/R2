import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

// Explicit `retrieval_runs` projection — additions must be added here
// intentionally so downstream callers see a stable response shape.
const RETRIEVAL_RUNS_SELECT_COLUMNS =
  'budget_profile,candidate_count,created_at,decomposition,dropped_context_reasons,filtered_count,final_count,id,latency_ms,metadata,oracle_context,query_hash,status';

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') {
      return corsResponse();
    }

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    try {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');
      const runId = url.searchParams.get('id');

      const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

      if (req.method === 'GET') {
        if (runId) {
          const { data, error } = await client
            .from('retrieval_runs')
            .select(RETRIEVAL_RUNS_SELECT_COLUMNS)
            .eq('id', runId)
            .single();

          if (error) {
            return errorResponse(error.message, 404);
          }

          return jsonResponse(data);
        } else {
          const status = url.searchParams.get('status');

          let query = client.from('retrieval_runs').select(RETRIEVAL_RUNS_SELECT_COLUMNS);

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
  }),
);
