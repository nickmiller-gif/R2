import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';

const supabaseClients = createSupabaseClientFactory();

async function requireOperatorForScope(userId: string): Promise<Response | null> {
  const roleCheck = await requireRole(userId, 'operator');
  if (!roleCheck.ok) return roleCheck.response;
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const signalId = url.searchParams.get('id');
    const scope = url.searchParams.get('scope') ?? 'published';

    const isOperatorScope = scope === 'operator';
    if (req.method === 'GET' && isOperatorScope) {
      const operatorError = await requireOperatorForScope(auth.claims.userId);
      if (operatorError) return operatorError;
    }
    const client =
      req.method === 'GET' && !isOperatorScope
        ? supabaseClients.user(req)
        : supabaseClients.service();

    if (req.method === 'GET') {
      if (signalId) {
        // GET single signal
        let query = client
          .from('oracle_signals')
          .select('*')
          .eq('id', signalId);

        if (scope === 'published') {
          query = query.eq('publication_state', 'published');
        }
        const { data, error } = await query.single();

        if (error) {
          return errorResponse(error.message, 404);
        }

        return jsonResponse(data);
      } else {
        // GET list with optional filters
        const entityAssetId = url.searchParams.get('entity_asset_id');
        const status = url.searchParams.get('status');
        const confidence = url.searchParams.get('confidence');
        const minScore = url.searchParams.get('min_score');
        const maxScore = url.searchParams.get('max_score');

        let query = client.from('oracle_signals').select('*');

        if (scope === 'published') {
          query = query.eq('publication_state', 'published');
        }
        if (entityAssetId) query = query.eq('entity_asset_id', entityAssetId);
        if (status) query = query.eq('status', status);
        if (confidence) query = query.eq('confidence', confidence);
        if (minScore) query = query.gte('score', parseFloat(minScore));
        if (maxScore) query = query.lte('score', parseFloat(maxScore));

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;
      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      const body = await req.json();

      if (action === 'publish' || action === 'approve' || action === 'reject' || action === 'defer') {
        const signalId = body.id;
        if (!signalId) {
          return errorResponse('id required in body', 400);
        }

        const { data: beforeUpdate, error: beforeUpdateError } = await client
          .from('oracle_signals')
          .select('publication_state')
          .eq('id', signalId)
          .single();
        if (beforeUpdateError) {
          return errorResponse(beforeUpdateError.message, 404);
        }

        const nextState =
          action === 'publish'
            ? 'published'
            : action === 'approve'
              ? 'approved'
              : action === 'reject'
                ? 'rejected'
                : 'deferred';
        const now = new Date().toISOString();
        const publicationPatch =
          nextState === 'published'
            ? { published_by: auth.claims.userId, published_at: now }
            : { published_by: null, published_at: null };

        const { data, error } = await client
          .from('oracle_signals')
          .update({
            publication_state: nextState,
            publication_notes: body.notes ?? null,
            ...publicationPatch,
          })
          .eq('id', signalId)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        await client.from('oracle_publication_events').insert({
          target_type: 'signal',
          target_id: signalId,
          from_state: beforeUpdate.publication_state,
          to_state: nextState,
          decided_by: auth.claims.userId,
          decided_at: now,
          notes: body.notes ?? null,
          metadata: {
            action,
          },
        });
        return jsonResponse(data);
      } else if (action === 'rescore') {
        // RESCORE signal
        const signalId = body.id;
        if (!signalId) {
          return errorResponse('id required in body', 400);
        }

        const { data, error } = await client
          .from('oracle_signals')
          .update({
            score: body.score,
            rescored_at: new Date().toISOString(),
          })
          .eq('id', signalId)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      } else {
        // CREATE signal
        const { data, error } = await client
          .from('oracle_signals')
          .insert([body])
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data, 201);
      }
    } else if (req.method === 'PATCH') {
      // UPDATE signal
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;
      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      const body = await req.json();
      const signalId = body.id;

      if (!signalId) {
        return errorResponse('id required in body', 400);
      }

      const { data, error } = await client
        .from('oracle_signals')
        .update(body)
        .eq('id', signalId)
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
