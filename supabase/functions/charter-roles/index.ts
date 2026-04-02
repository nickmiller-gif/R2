import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const id = pathname.split('/').pop() === 'charter-roles' ? null : pathname.split('/').pop();

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (id) {
        // GET single role
        const { data, error } = await client
          .from('charter_user_roles')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          return errorResponse(error.message, 404);
        }

        return jsonResponse(data);
      } else {
        // GET list with optional filters
        const userId = url.searchParams.get('user_id');
        const role = url.searchParams.get('role');

        let query = client.from('charter_user_roles').select('*');

        if (userId) query = query.eq('user_id', userId);
        if (role) query = query.eq('role', role);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      // CREATE role assignment
      const body = await req.json();
      const { data, error } = await client
        .from('charter_user_roles')
        .insert([body])
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 400);
      }

      return jsonResponse(data, 201);
    } else if (req.method === 'PATCH') {
      // UPDATE role assignment
      const body = await req.json();
      const roleId = body.id;

      if (!roleId) {
        return errorResponse('id required in body', 400);
      }

      const { data, error } = await client
        .from('charter_user_roles')
        .update(body)
        .eq('id', roleId)
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
