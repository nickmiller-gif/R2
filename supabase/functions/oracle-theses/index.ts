import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
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
    const thesisId = url.searchParams.get('id');
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
      if (thesisId) {
        // GET single thesis
        let query = client
          .from('oracle_theses')
          .select('*')
          .eq('id', thesisId);

        if (scope === 'published') {
          query = query.eq('publication_state', 'published');
        } else if (scope === 'mine') {
          query = query.eq('profile_id', auth.claims.userId);
        }
        const { data, error } = await query.single();

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

        if (scope === 'published') {
          query = query.eq('publication_state', 'published');
        } else if (scope === 'mine') {
          query = query.eq('profile_id', auth.claims.userId);
        }
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
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;
      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      const body = await req.json();

      if (action === 'publish' || action === 'approve' || action === 'reject' || action === 'defer') {
        const thesisId = body.id;
        if (!thesisId) {
          return errorResponse('id required in body', 400);
        }
        const { data: beforeUpdate, error: beforeUpdateError } = await client
          .from('oracle_theses')
          .select('publication_state')
          .eq('id', thesisId)
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
          .from('oracle_theses')
          .update({
            publication_state: nextState,
            ...publicationPatch,
            last_decision_by: auth.claims.userId,
            last_decision_at: now,
            decision_metadata: {
              ...(body.decision_metadata ?? {}),
              action,
              notes: body.notes ?? null,
            },
          })
          .eq('id', thesisId)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        const { error: auditError } = await client.from('oracle_publication_events').insert({
          target_type: 'thesis',
          target_id: thesisId,
          from_state: beforeUpdate.publication_state,
          to_state: nextState,
          decided_by: auth.claims.userId,
          decided_at: now,
          notes: body.notes ?? null,
          metadata: {
            action,
          },
        });

        if (auditError) {
          return errorResponse(`Publication state updated but audit event failed: ${auditError.message}`, 500);
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
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;
      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

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
