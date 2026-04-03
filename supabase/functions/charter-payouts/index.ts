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
    const segments = pathname.split('/').filter(Boolean);
    const id = segments[segments.length - 1] === 'charter-payouts' ? null : segments[segments.length - 1];
    const action = segments[segments.length - 1] === 'approve' ? 'approve' : null;

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (id) {
        // GET single payout
        const { data, error } = await client
          .from('charter_payouts')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          return errorResponse(error.message, 404);
        }

        return jsonResponse(data);
      } else {
        // GET list with optional filters
        const entityId = url.searchParams.get('entity_id');
        const status = url.searchParams.get('status');

        let query = client.from('charter_payouts').select('*');

        if (entityId) query = query.eq('entity_id', entityId);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      // Check if this is an approve action
      if (action === 'approve') {
        const body = await req.json();
        const payoutId = body.id;
        const approvedBy = body.approvedBy;

        if (!payoutId || !approvedBy) {
          return errorResponse('id and approvedBy required', 400);
        }

        const { data, error } = await client
          .from('charter_payouts')
          .update({ status: 'approved', approved_by: approvedBy, updated_at: new Date().toISOString() })
          .eq('id', payoutId)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }

      // CREATE payout
      const body = await req.json();
      const { data, error } = await client
        .from('charter_payouts')
        .insert([body])
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 400);
      }

      return jsonResponse(data, 201);
    } else if (req.method === 'PATCH') {
      // UPDATE payout
      const body = await req.json();
      const payoutId = body.id;

      if (!payoutId) {
        return errorResponse('id required in body', 400);
      }

      const { data, error } = await client
        .from('charter_payouts')
        .update(body)
        .eq('id', payoutId)
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
