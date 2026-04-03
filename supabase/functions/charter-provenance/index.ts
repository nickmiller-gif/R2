import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const auth = guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    const id = lastSegment === 'charter-provenance' ? null : lastSegment;

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (id) {
        // GET single provenance event
        const { data, error } = await client
          .from('charter_provenance_events')
          .select('*')
          .eq('id', id)
          .single();
        if (error) return errorResponse(error.message, 404);
        return jsonResponse(data);
      } else {
        // GET list with optional filters
        const entityId = url.searchParams.get('entity_id');
        const eventType = url.searchParams.get('event_type');
        const actorId = url.searchParams.get('actor_id');

        let query = client.from('charter_provenance_events').select('*');
        if (entityId) query = query.eq('entity_id', entityId);
        if (eventType) query = query.eq('event_type', eventType);
        if (actorId) query = query.eq('actor_id', actorId);

        const { data, error } = await query;
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      // APPEND provenance event (immutable — no PATCH or DELETE)
      const body = await req.json();
      const { data, error } = await client
        .from('charter_provenance_events')
        .insert([body])
        .select()
        .single();
      if (error) return errorResponse(error.message, 400);
      return jsonResponse(data, 201);
    } else {
      return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
