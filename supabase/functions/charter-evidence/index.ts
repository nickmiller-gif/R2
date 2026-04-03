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
    const id = pathname.split('/').pop() === 'charter-evidence' ? null : pathname.split('/').pop();

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (id) {
        // GET single evidence
        const { data, error } = await client
          .from('charter_evidence')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          return errorResponse(error.message, 404);
        }

        return jsonResponse(data);
      } else {
        // GET list with optional filters
        const linkedTable = url.searchParams.get('linked_table');
        const linkedId = url.searchParams.get('linked_id');
        const status = url.searchParams.get('status');

        let query = client.from('charter_evidence').select('*');

        if (linkedTable) query = query.eq('linked_table', linkedTable);
        if (linkedId) query = query.eq('linked_id', linkedId);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      // CREATE evidence
      const body = await req.json();
      const { data, error } = await client
        .from('charter_evidence')
        .insert([body])
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 400);
      }

      return jsonResponse(data, 201);
    } else if (req.method === 'PATCH') {
      // UPDATE evidence
      const body = await req.json();
      const evidenceId = body.id;

      if (!evidenceId) {
        return errorResponse('id required in body', 400);
      }

      const { data, error } = await client
        .from('charter_evidence')
        .update(body)
        .eq('id', evidenceId)
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
