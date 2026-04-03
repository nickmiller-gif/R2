import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    const id = lastSegment === 'meg-entities' ? null : lastSegment;
    const action = url.searchParams.get('action');

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await client
          .from('meg_entities')
          .select('*')
          .eq('id', id)
          .single();
        if (error) return errorResponse(error.message, 404);
        return jsonResponse(data);
      } else {
        const profileId = url.searchParams.get('profile_id');
        const entityType = url.searchParams.get('entity_type');
        const status = url.searchParams.get('status');
        const canonicalNameLike = url.searchParams.get('canonical_name_like');

        let query = client.from('meg_entities').select('*');
        if (profileId) query = query.eq('profile_id', profileId);
        if (entityType) query = query.eq('entity_type', entityType);
        if (status) query = query.eq('status', status);
        if (canonicalNameLike) query = query.ilike('canonical_name', `%${canonicalNameLike}%`);

        const { data, error } = await query;
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      const body = await req.json();

      if (action === 'merge') {
        // MERGE source entity into target entity
        const { sourceId, targetId } = body;
        if (!sourceId || !targetId) {
          return errorResponse('sourceId and targetId are required', 400);
        }

        const { data, error } = await client
          .from('meg_entities')
          .update({
            status: 'merged',
            merged_into_id: targetId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sourceId)
          .select()
          .single();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data);
      } else if (action === 'archive') {
        // ARCHIVE an entity
        const entityId = body.id;
        if (!entityId) return errorResponse('id required in body', 400);

        const { data, error } = await client
          .from('meg_entities')
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('id', entityId)
          .select()
          .single();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data);
      } else {
        // CREATE entity
        const { data, error } = await client
          .from('meg_entities')
          .insert([body])
          .select()
          .single();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data, 201);
      }
    } else if (req.method === 'PATCH') {
      // UPDATE entity — only allowlisted fields may be changed
      const body = await req.json();
      const entityId = body.id;
      if (!entityId) return errorResponse('id required in body', 400);

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.canonical_name !== undefined) patch.canonical_name = body.canonical_name;
      if (body.entity_type !== undefined) patch.entity_type = body.entity_type;
      if (body.status !== undefined) patch.status = body.status;
      if (body.external_ids !== undefined) patch.external_ids = body.external_ids;
      if (body.attributes !== undefined) patch.attributes = body.attributes;
      if (body.metadata !== undefined) patch.metadata = body.metadata;

      const { data, error } = await client
        .from('meg_entities')
        .update(patch)
        .eq('id', entityId)
        .select()
        .single();
      if (error) return errorResponse(error.message, 400);
      return jsonResponse(data);
    } else {
      return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
