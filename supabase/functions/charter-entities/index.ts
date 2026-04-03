import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const auth = guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const id = pathname.split('/').pop() === 'charter-entities' ? null : pathname.split('/').pop();

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (id) {
        // GET single entity
        const { data, error } = await client
          .from('charter_entities')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          return errorResponse(error.message, 404);
        }

        return jsonResponse(data);
      } else {
        // GET list with optional filters
        const entityType = url.searchParams.get('entity_type');
        const status = url.searchParams.get('status');

        let query = client.from('charter_entities').select('*');

        if (entityType) query = query.eq('entity_type', entityType);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      // CREATE entity
      const body = await req.json();
      const { data, error } = await client
        .from('charter_entities')
        .insert([body])
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 400);
      }

      return jsonResponse(data, 201);
    } else if (req.method === 'PATCH') {
      // UPDATE entity
      const body = await req.json();
      const entityId = body.id;

      if (!entityId) {
        return errorResponse('id required in body', 400);
      }

      const { data, error } = await client
        .from('charter_entities')
        .update(body)
        .eq('id', entityId)
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
