import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const runId = url.searchParams.get('id');

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (runId) {
        const { data, error } = await client
          .from('eigen_retrieval_runs')
          .select('*')
          .eq('id', runId)
          .single();

        if (error) {
          return errorResponse(error.message, 404);
        }

        return jsonResponse(data);
      } else {
        const status = url.searchParams.get('status');

        let query = client.from('eigen_retrieval_runs').select('*');

        if (status) query = query.eq('status', status);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      const body = await req.json();

      if (action === 'complete') {
        const id = body.id;
        if (!id) {
          return errorResponse('id required in body', 400);
        }

        const { data, error } = await client
          .from('eigen_retrieval_runs')
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
          .from('eigen_retrieval_runs')
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
          .from('eigen_retrieval_runs')
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
