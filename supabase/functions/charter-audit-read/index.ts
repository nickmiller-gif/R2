import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const auth = guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    if (req.method !== 'GET') {
      return errorResponse('Method not allowed', 405);
    }

    const url = new URL(req.url);
    const pathname = url.pathname;
    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    const eventId = lastSegment === 'charter-audit-read' ? null : lastSegment;

    const client = getSupabaseClient(req);

    if (eventId) {
      // GET single audit entry by event ID
      const { data, error } = await client
        .from('charter_audit_log')
        .select('*')
        .eq('event_id', eventId)
        .single();
      if (error) return errorResponse(error.message, 404);
      return jsonResponse(data);
    } else {
      // Query audit log with optional filters and pagination
      const entityId = url.searchParams.get('entity_id');
      const actorId = url.searchParams.get('actor_id');
      const eventType = url.searchParams.get('event_type');
      const refCode = url.searchParams.get('ref_code');
      const entityKind = url.searchParams.get('entity_kind');
      const limit = url.searchParams.get('limit');
      const offset = url.searchParams.get('offset');

      let query = client.from('charter_audit_log').select('*', { count: 'exact' });
      if (entityId) query = query.eq('entity_id', entityId);
      if (actorId) query = query.eq('actor_id', actorId);
      if (eventType) query = query.eq('event_type', eventType);
      if (refCode) query = query.eq('ref_code', refCode);
      if (entityKind) query = query.eq('entity_kind', entityKind);

      const parsedLimit = limit ? parseInt(limit, 10) : 100;
      const parsedOffset = offset ? parseInt(offset, 10) : 0;
      query = query.order('recorded_at', { ascending: false });
      query = query.range(parsedOffset, parsedOffset + parsedLimit - 1);

      const { data, error, count } = await query;
      if (error) return errorResponse(error.message, 400);
      return jsonResponse({ entries: data, total: count ?? 0 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
