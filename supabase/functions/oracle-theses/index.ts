import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { buildSafeThesisPatch } from '../../../src/services/oracle/oracle-patch-builders.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { logError } from '../_shared/log.ts';

const supabaseClients = createSupabaseClientFactory();

async function requireOperatorForScope(userId: string): Promise<Response | null> {
  const roleCheck = await requireRole(userId, 'operator');
  if (!roleCheck.ok) return roleCheck.response;
  return null;
}

Deno.serve(
  withRequestMeta(async (req) => {
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
            .select(
              'access_policy,confidence,contradiction_evidence_item_ids,created_at,decision_metadata,duplicate_of_thesis_id,evidence_strength,id,inspiration_evidence_item_ids,inspiration_signal_ids,last_decision_at,last_decision_by,meg_entity_id,metadata,novelty_status,platform_id,profile_id,publication_state,published_at,published_by,site_domain,status,superseded_by_thesis_id,thesis_statement,title,uncertainty_summary,updated_at,validation_evidence_item_ids,visibility_class',
            )
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

          let query = client
            .from('oracle_theses')
            .select(
              'access_policy,confidence,contradiction_evidence_item_ids,created_at,decision_metadata,duplicate_of_thesis_id,evidence_strength,id,inspiration_evidence_item_ids,inspiration_signal_ids,last_decision_at,last_decision_by,meg_entity_id,metadata,novelty_status,platform_id,profile_id,publication_state,published_at,published_by,site_domain,status,superseded_by_thesis_id,thesis_statement,title,uncertainty_summary,updated_at,validation_evidence_item_ids,visibility_class',
            );

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

        if (
          action === 'publish' ||
          action === 'approve' ||
          action === 'reject' ||
          action === 'defer'
        ) {
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
            return errorResponse(
              `Publication state updated but audit event failed: ${auditError.message}`,
              500,
            );
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

        const patch = buildSafeThesisPatch(body as Record<string, unknown>);
        if (Object.keys(patch).length === 1) {
          return errorResponse(
            'No patchable fields provided. Allowed fields: title, thesis_statement, meg_entity_id, status, novelty_status, confidence, evidence_strength, uncertainty_summary, publication_state, metadata',
            400,
          );
        }
        const successorId = String(body.superseded_by_thesis_id);
        if (successorId === thesisId) {
          return errorResponse('superseded_by_thesis_id must differ from id', 400);
        }

        const { data: predecessorRow, error: predecessorErr } = await client
          .from('oracle_theses')
          .select('publication_state,status')
          .eq('id', thesisId)
          .single();
        if (predecessorErr || !predecessorRow) {
          return errorResponse(predecessorErr?.message ?? 'Thesis not found', 404);
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

        const now = new Date().toISOString();
        const { data, error } = await client
          .from('oracle_theses')
          .update(patch)
          .eq('id', thesisId)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        const predPub = predecessorRow.publication_state as string;
        const predStatus = predecessorRow.status as string;
        const auditWarnings: string[] = [];
        const auditPredecessor = await insertOraclePublicationAuditEvent(client, {
          targetType: 'thesis',
          targetId: thesisId,
          fromState: predPub,
          toState: 'superseded',
          decidedBy: auth.claims.userId,
          decidedAt: now,
          notes: body.notes ?? null,
          action: 'supersede_predecessor',
          metadata: {
            successor_thesis_id: successorId,
            predecessor_status_before: predStatus,
          },
        });
        if (auditPredecessor) {
          logError('supersede_predecessor audit failed', {
            functionName: 'oracle-theses',
            thesisId,
            successorId,
            error: auditPredecessor,
          });
          auditWarnings.push(`supersede_predecessor:${auditPredecessor}`);
        }
        const auditSuccessor = await insertOraclePublicationAuditEvent(client, {
          targetType: 'thesis',
          targetId: successorId,
          fromState: null,
          toState: 'successor_of',
          decidedBy: auth.claims.userId,
          decidedAt: now,
          notes: body.notes ?? null,
          action: 'supersede_successor',
          metadata: { predecessor_thesis_id: thesisId },
        });
        if (auditSuccessor) {
          logError('supersede_successor audit failed', {
            functionName: 'oracle-theses',
            thesisId,
            successorId,
            error: auditSuccessor,
          });
          auditWarnings.push(`supersede_successor:${auditSuccessor}`);
        }

        const responseBody =
          auditWarnings.length > 0 && data && typeof data === 'object'
            ? { ...(data as Record<string, unknown>), auditWarnings }
            : data;
        return jsonResponse(responseBody);
      } else {
        return errorResponse('Method not allowed', 405);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return errorResponse(message, 500);
    }
  }),
);
