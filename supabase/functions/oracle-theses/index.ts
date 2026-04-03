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
    const action = url.searchParams.get('action');
    const thesisId = url.searchParams.get('id');

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (thesisId) {
        // GET single thesis
        const { data, error } = await client
          .from('oracle_theses')
          .select('*')
          .eq('id', thesisId)
          .single();

        if (error) {
          return errorResponse(error.message, 404);
        }

        return jsonResponse(data);
      } else {
        // GET list with optional filters
        const profileId = url.searchParams.get('profile_id');
        const status = url.searchParams.get('status');
        const publicationState = url.searchParams.get('publication_state');
        const noveltyStatus = url.searchParams.get('novelty_status');

        let query = client.from('oracle_theses').select('*');

        if (profileId) query = query.eq('profile_id', profileId);
        if (status) query = query.eq('status', status);
        if (publicationState) query = query.eq('publication_state', publicationState);
        if (noveltyStatus) query = query.eq('novelty_status', noveltyStatus);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      const body = await req.json();

      if (action === 'publish') {
        // PUBLISH thesis
        if (!body.published_by) {
          return errorResponse('published_by required', 400);
        }

        const thesisId = body.id;
        if (!thesisId) {
          return errorResponse('id required in body', 400);
        }

        const { data, error } = await client
          .from('oracle_theses')
          .update({
            publication_state: 'published',
            published_by: body.published_by,
            published_at: new Date().toISOString(),
          })
          .eq('id', thesisId)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      } else if (action === 'challenge') {
        // CHALLENGE thesis
        const thesisId = body.id;
        if (!thesisId) {
          return errorResponse('id required in body', 400);
        }

        const { data, error } = await client
          .from('oracle_theses')
          .update({ status: 'challenged' })
          .eq('id', thesisId)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      } else if (action === 'supersede') {
        // SUPERSEDE thesis
        if (!body.superseded_by_thesis_id) {
          return errorResponse('superseded_by_thesis_id required', 400);
        }

        const thesisId = body.id;
        if (!thesisId) {
          return errorResponse('id required in body', 400);
        }

        const { data, error } = await client
          .from('oracle_theses')
          .update({
            status: 'superseded',
            superseded_by_thesis_id: body.superseded_by_thesis_id,
          })
          .eq('id', thesisId)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      } else {
        // CREATE thesis
        const { data, error } = await client
          .from('oracle_theses')
          .insert([body])
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data, 201);
      }
    } else if (req.method === 'PATCH') {
      // UPDATE thesis
      const body = await req.json();
      const thesisId = body.id;

      if (!thesisId) {
        return errorResponse('id required in body', 400);
      }

      const { data, error } = await client
        .from('oracle_theses')
        .update(body)
        .eq('id', thesisId)
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
