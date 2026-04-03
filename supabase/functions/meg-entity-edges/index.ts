import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    const id = lastSegment === 'meg-entity-edges' ? null : lastSegment;

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await client
          .from('meg_entity_edges')
          .select('*')
          .eq('id', id)
          .single();
        if (error) return errorResponse(error.message, 404);
        return jsonResponse(data);
      } else {
        const sourceEntityId = url.searchParams.get('source_entity_id');
        const targetEntityId = url.searchParams.get('target_entity_id');
        const edgeType = url.searchParams.get('edge_type');
        const eitherEntityId = url.searchParams.get('either_entity_id');

        let query = client.from('meg_entity_edges').select('*');

        if (eitherEntityId) {
          const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!UUID_RE.test(eitherEntityId)) return errorResponse('invalid either_entity_id', 400);
          // Match edges where entity appears as source OR target
          query = query.or(
            `source_entity_id.eq.${eitherEntityId},target_entity_id.eq.${eitherEntityId}`
          );
        } else {
          if (sourceEntityId) query = query.eq('source_entity_id', sourceEntityId);
          if (targetEntityId) query = query.eq('target_entity_id', targetEntityId);
        }
        if (edgeType) query = query.eq('edge_type', edgeType);

        const { data, error } = await query;
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      // CREATE edge
      const body = await req.json();
      const { data, error } = await client
        .from('meg_entity_edges')
        .insert([body])
        .select()
        .single();
      if (error) return errorResponse(error.message, 400);
      return jsonResponse(data, 201);
    } else if (req.method === 'PATCH') {
      // UPDATE edge — only allowlisted fields may be changed
      const body = await req.json();
      const edgeId = body.id;
      if (!edgeId) return errorResponse('id required in body', 400);

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.confidence !== undefined) patch.confidence = body.confidence;
      if (body.valid_from !== undefined) patch.valid_from = body.valid_from;
      if (body.valid_to !== undefined) patch.valid_to = body.valid_to;
      if (body.metadata !== undefined) patch.metadata = body.metadata;

      const { data, error } = await client
        .from('meg_entity_edges')
        .update(patch)
        .eq('id', edgeId)
        .select()
        .single();
      if (error) return errorResponse(error.message, 400);
      return jsonResponse(data);
    } else if (req.method === 'DELETE') {
      // DELETE edge by id
      const deleteId = id ?? url.searchParams.get('id');
      if (!deleteId) return errorResponse('id required', 400);

      const { error } = await client
        .from('meg_entity_edges')
        .delete()
        .eq('id', deleteId);
      if (error) return errorResponse(error.message, 400);
      return jsonResponse({ deleted: true });
    } else {
      return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
