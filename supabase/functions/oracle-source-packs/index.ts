import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

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
});
