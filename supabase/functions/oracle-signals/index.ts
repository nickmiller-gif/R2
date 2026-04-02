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
    const signalId = url.searchParams.get('id');

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (signalId) {
        // GET single signal
        const { data, error } = await client
          .from('oracle_signals')
          .select('*')
          .eq('id', signalId)
          .single();

        if (error) {
          return errorResponse(error.message, 404);
        }

        return jsonResponse(data);
      } else {
        // GET list with optional filters
        const entityAssetId = url.searchParams.get('entity_asset_id');
        const status = url.searchParams.get('status');
        const confidence = url.searchParams.get('confidence');
        const minScore = url.searchParams.get('min_score');
        const maxScore = url.searchParams.get('max_score');

        let query = client.from('oracle_signals').select('*');

        if (entityAssetId) query = query.eq('entity_asset_id', entityAssetId);
        if (status) query = query.eq('status', status);
        if (confidence) query = query.eq('confidence', confidence);
        if (minScore) query = query.gte('score', parseFloat(minScore));
        if (maxScore) query = query.lte('score', parseFloat(maxScore));

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      const body = await req.json();

      if (action === 'rescore') {
        // RESCORE signal
        const signalId = body.id;
        if (!signalId) {
          return errorResponse('id required in body', 400);
        }

        const { data, error } = await client
          .from('oracle_signals')
          .update({
            score: body.score,
            rescored_at: new Date().toISOString(),
          })
          .eq('id', signalId)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      } else {
        // CREATE signal
        const { data, error } = await client
          .from('oracle_signals')
          .insert([body])
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data, 201);
      }
    } else if (req.method === 'PATCH') {
      // UPDATE signal
      const body = await req.json();
      const signalId = body.id;

      if (!signalId) {
        return errorResponse('id required in body', 400);
      }

      const { data, error } = await client
        .from('oracle_signals')
        .update(body)
        .eq('id', signalId)
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
});
