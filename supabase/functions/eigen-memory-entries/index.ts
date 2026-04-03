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
    const entryId = url.searchParams.get('id');

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (entryId) {
        const { data, error } = await client
          .from('memory_entries')
          .select('*')
          .eq('id', entryId)
          .single();

        if (error) {
          return errorResponse(error.message, 404);
        }

        return jsonResponse(data);
      } else {
        const scope = url.searchParams.get('scope');
        const ownerId = url.searchParams.get('owner_id');
        const key = url.searchParams.get('key');
        const retentionClass = url.searchParams.get('retention_class');

        let query = client.from('memory_entries').select('*');

        if (scope) query = query.eq('scope', scope);
        if (ownerId) query = query.eq('owner_id', ownerId);
        if (key) query = query.eq('key', key);
        if (retentionClass) query = query.eq('retention_class', retentionClass);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      const body = await req.json();

      if (action === 'supersede') {
        const id = body.id;
        const newId = body.new_id;

        if (!id || !newId) {
          return errorResponse('id and new_id required in body', 400);
        }

        const { data, error } = await client
          .from('memory_entries')
          .update({ superseded_by: newId })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      } else {
        // CREATE entry
        const { data, error } = await client
          .from('memory_entries')
          .insert([body])
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data, 201);
      }
    } else if (req.method === 'PATCH') {
      const body = await req.json();
      const id = body.id;

      if (!id) {
        return errorResponse('id required in body', 400);
      }

      const { data, error } = await client
        .from('memory_entries')
        .update(body)
        .eq('id', id)
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
