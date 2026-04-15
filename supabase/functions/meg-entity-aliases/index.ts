import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    const id = lastSegment === 'meg-entity-aliases' ? null : lastSegment;
    const action = url.searchParams.get('action');

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (action === 'resolve') {
        // RESOLVE aliases by value
        const aliasValue = url.searchParams.get('alias_value');
        if (!aliasValue) return errorResponse('alias_value required for resolve', 400);

        const { data, error } = await client
          .from('meg_entity_aliases')
          .select('*')
          .eq('alias_value', aliasValue);
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data);
      } else if (id) {
        const { data, error } = await client
          .from('meg_entity_aliases')
          .select('*')
          .eq('id', id)
          .single();
        if (error) return errorResponse(error.message, 404);
        return jsonResponse(data);
      } else {
        const megEntityId = url.searchParams.get('meg_entity_id');
        const aliasKind = url.searchParams.get('alias_kind');
        const aliasValue = url.searchParams.get('alias_value');

        let query = client.from('meg_entity_aliases').select('*');
        if (megEntityId) query = query.eq('meg_entity_id', megEntityId);
        if (aliasKind) query = query.eq('alias_kind', aliasKind);
        if (aliasValue) query = query.eq('alias_value', aliasValue);

        const { data, error } = await query;
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      // CREATE alias
      const roleCheck = await requireRole(auth.claims.userId, 'operator'); if (!roleCheck.ok) return roleCheck.response;
      const idemError = requireIdempotencyKey(req); if (idemError) return idemError;
      const body = await req.json();
      const { data, error } = await client
        .from('meg_entity_aliases')
        .insert([body])
        .select()
        .single();
      if (error) return errorResponse(error.message, 400);
      return jsonResponse(data, 201);
    } else if (req.method === 'DELETE') {
      // DELETE alias by id (query param or body)
      const roleCheck = await requireRole(auth.claims.userId, 'operator'); if (!roleCheck.ok) return roleCheck.response;
      const idemError = requireIdempotencyKey(req); if (idemError) return idemError;
      const deleteId = id ?? url.searchParams.get('id');
      if (!deleteId) return errorResponse('id required', 400);

      const { error } = await client
        .from('meg_entity_aliases')
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
