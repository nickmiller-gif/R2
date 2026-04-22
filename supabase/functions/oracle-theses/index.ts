import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import {
  buildSafeThesisPatch,
  formatAllowedThesisPatchFields,
} from '../../../src/services/oracle/oracle-patch-builders.ts';
import { insertOraclePublicationAuditEvent } from '../_shared/oracle-publication-audit.ts';

const supabaseClients = createSupabaseClientFactory();

async function requireOperatorForScope(userId: string): Promise<Response | null> {
  const roleCheck = await requireRole(userId, 'operator');
  if (!roleCheck.ok) return roleCheck.response;
  return null;
}

Deno.serve(async (req) => {
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

        const auditErr = await insertOraclePublicationAuditEvent(client, {
          targetType: 'thesis',
          targetId: thesisId,
          fromState: beforeUpdate.publication_state,
          toState: nextState,
          decidedBy: auth.claims.userId,
          decidedAt: now,
          notes: body.notes ?? null,
          action,
        });
        if (auditErr) {
          return errorResponse(`Publication state updated but audit event failed: ${auditErr}`, 500);
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
        // SUPERSEDE thesis — align with versioned supersede: successor must exist and differ from self.
        if (!body.superseded_by_thesis_id) {
          return errorResponse('superseded_by_thesis_id required', 400);
        }

        const thesisId = body.id;
        if (!thesisId) {
          return errorResponse('id required in body', 400);
        }
        const successorId = String(body.superseded_by_thesis_id);
        if (successorId === thesisId) {
          return errorResponse('superseded_by_thesis_id must differ from id', 400);
        }

        const { data: successor, error: successorError } = await client
          .from('oracle_theses')
          .select('id')
          .eq('id', successorId)
          .maybeSingle();
        if (successorError) {
          return errorResponse(successorError.message, 500);
        }
        if (!successor) {
          return errorResponse(`Successor thesis not found: ${successorId}`, 404);
        }

        const { data, error } = await client
          .from('oracle_theses')
          .update({
            status: 'superseded',
            superseded_by_thesis_id: successorId,
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

      const patch = buildSafeThesisPatch(body as Record<string, unknown>);
      if (Object.keys(patch).length === 1) {
        return errorResponse(
          `No patchable fields provided. Allowed fields: ${formatAllowedThesisPatchFields()}`,
          400,
        );
      }

      const { data, error } = await client
        .from('oracle_theses')
        .update(patch)
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
