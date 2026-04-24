import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { logError } from '../_shared/log.ts';
import { insertOraclePublicationAuditEvent } from '../_shared/oracle-publication-audit.ts';
import {
  buildSafeSignalPatch,
  buildSafeSignalRescoreOverrides,
  formatAllowedSignalPatchFields,
} from '../../../src/services/oracle/oracle-patch-builders.ts';

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
            .select(
              'analysis_document_id,confidence,created_at,entity_asset_id,id,producer_ref,reasons,score,scored_at,source_asset_id,status,tags,updated_at,version',
            )
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

          let query = client
            .from('oracle_signals')
            .select(
              'analysis_document_id,confidence,created_at,entity_asset_id,id,producer_ref,reasons,score,scored_at,source_asset_id,status,tags,updated_at,version',
            );

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

        if (
          action === 'publish' ||
          action === 'approve' ||
          action === 'reject' ||
          action === 'defer'
        ) {
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

          const { error: auditError } = await client.from('oracle_publication_events').insert({
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

          if (auditError) {
            return errorResponse(
              `Publication state updated but audit event failed: ${auditError.message}`,
              500,
            );
          }
          return jsonResponse(data);
        } else if (action === 'rescore') {
          // Versioned supersede: insert a new oracle_signals row carrying the predecessor's
          // metadata plus the operator's overrides, then mark the predecessor as superseded
          // and emit paired oracle_publication_events rows.
          //
          // Unlike the old in-place update, this preserves the full audit trail required for
          // operator review (the predecessor's score, reasons, and publication state stay
          // readable on the original row; the new row enters `pending_review`).
          const previousId = body.id;
          if (!previousId || typeof previousId !== 'string') {
            return errorResponse('id required in body', 400);
          }
          if (body.score === undefined || body.score === null) {
            return errorResponse('score required for rescore', 400);
          }

          const overrides = buildSafeSignalRescoreOverrides(body as Record<string, unknown>);

          const { data: previousRow, error: previousErr } = await client
            .from('oracle_signals')
            .select(
              'id,entity_asset_id,score,confidence,reasons,tags,status,analysis_document_id,source_asset_id,producer_ref,version,publication_state',
            )
            .eq('id', previousId)
            .single();
          if (previousErr || !previousRow) {
            return errorResponse(previousErr?.message ?? 'Previous signal not found', 404);
          }

          const now = new Date().toISOString();
          const successorRow: Record<string, unknown> = {
            entity_asset_id: previousRow.entity_asset_id,
            score: previousRow.score,
            confidence: previousRow.confidence,
            reasons: previousRow.reasons,
            tags: previousRow.tags,
            status: 'scored',
            analysis_document_id: previousRow.analysis_document_id,
            source_asset_id: previousRow.source_asset_id,
            producer_ref: previousRow.producer_ref,
            version: (previousRow.version ?? 1) + 1,
            publication_state: 'pending_review',
            published_at: null,
            published_by: null,
            publication_notes: null,
            scored_at: now,
            ...overrides,
          };

          const { data: inserted, error: insertErr } = await client
            .from('oracle_signals')
            .insert([successorRow])
            .select()
            .single();
          if (insertErr || !inserted) {
            return errorResponse(insertErr?.message ?? 'Failed to insert rescored signal', 400);
          }
          const newId = inserted.id as string;

          const { error: supersedeErr } = await client
            .from('oracle_signals')
            .update({ status: 'superseded', updated_at: now })
            .eq('id', previousId);
          if (supersedeErr) {
            logError('rescore predecessor supersede failed', {
              functionName: 'oracle-signals',
              previousId,
              newId,
              error: supersedeErr.message,
            });
            return errorResponse(
              `Rescored signal created (${newId}) but predecessor supersede failed: ${supersedeErr.message}`,
              500,
            );
          }

          const auditWarnings: string[] = [];
          const notes = typeof body.notes === 'string' ? body.notes : null;
          const newScore = successorRow.score;
          const auditPrev = await insertOraclePublicationAuditEvent(client, {
            targetType: 'signal',
            targetId: previousId,
            fromState: (previousRow.publication_state as string | null) ?? null,
            toState: 'superseded',
            decidedBy: auth.claims.userId,
            decidedAt: now,
            notes,
            action: 'rescore_supersede_previous',
            metadata: { successor_signal_id: newId, new_score: newScore },
          });
          if (auditPrev) {
            logError('rescore_supersede_previous audit failed', {
              functionName: 'oracle-signals',
              previousId,
              newId,
              error: auditPrev,
            });
            auditWarnings.push(`rescore_supersede_previous:${auditPrev}`);
          }

          const auditNew = await insertOraclePublicationAuditEvent(client, {
            targetType: 'signal',
            targetId: newId,
            fromState: null,
            toState: 'pending_review',
            decidedBy: auth.claims.userId,
            decidedAt: now,
            notes,
            action: 'rescore_new_version',
            metadata: { predecessor_signal_id: previousId, new_score: newScore },
          });
          if (auditNew) {
            logError('rescore_new_version audit failed', {
              functionName: 'oracle-signals',
              previousId,
              newId,
              error: auditNew,
            });
            auditWarnings.push(`rescore_new_version:${auditNew}`);
          }

          const responseBody =
            auditWarnings.length > 0 && inserted && typeof inserted === 'object'
              ? { ...(inserted as Record<string, unknown>), auditWarnings }
              : inserted;
          return jsonResponse(responseBody, 201);
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
        const roleCheck = await requireRole(auth.claims.userId, 'operator');
        if (!roleCheck.ok) return roleCheck.response;
        const idemError = requireIdempotencyKey(req);
        if (idemError) return idemError;

        const body = await req.json();
        const signalId = body.id;

        if (!signalId) {
          return errorResponse('id required in body', 400);
        }

        const patch = buildSafeSignalPatch(body as Record<string, unknown>);
        if (Object.keys(patch).length === 1) {
          return errorResponse(
            `No patchable fields provided. Allowed fields: ${formatAllowedSignalPatchFields()}`,
            400,
          );
        }

        const { data, error } = await client
          .from('oracle_signals')
          .update(patch)
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
  }),
);
