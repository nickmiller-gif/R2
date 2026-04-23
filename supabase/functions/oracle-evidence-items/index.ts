import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { buildSafeEvidenceItemPatch } from '../../../src/services/oracle/oracle-patch-builders.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

const supabaseClients = createSupabaseClientFactory();

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') {
      return corsResponse();
    }

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    try {
      const url = new URL(req.url);
      const evidenceId = url.searchParams.get('id');

      const client = req.method === 'GET' ? supabaseClients.user(req) : supabaseClients.service();

      if (req.method === 'GET') {
        if (evidenceId) {
          // GET single evidence item
          const { data, error } = await client
            .from('oracle_evidence_items')
            .select(
              'author_info,confidence,content_summary,created_at,evidence_strength,id,metadata,profile_id,publication_url,signal_id,source_class,source_date,source_lane,source_ref,updated_at',
            )
            .eq('id', evidenceId)
            .single();

          if (error) {
            return errorResponse(error.message, 404);
          }

          return jsonResponse(data);
        } else {
          // GET list with optional filters
          const signalId = url.searchParams.get('signal_id');
          const sourceLane = url.searchParams.get('source_lane');

          let query = client
            .from('oracle_evidence_items')
            .select(
              'author_info,confidence,content_summary,created_at,evidence_strength,id,metadata,profile_id,publication_url,signal_id,source_class,source_date,source_lane,source_ref,updated_at',
            );

          if (signalId) query = query.eq('signal_id', signalId);
          if (sourceLane) query = query.eq('source_lane', sourceLane);

          const { data, error } = await query;

          if (error) {
            return errorResponse(error.message, 400);
          }

          return jsonResponse(data);
        }
      } else if (req.method === 'POST') {
        // CREATE evidence item
        const roleCheck = await requireRole(auth.claims.userId, 'operator');
        if (!roleCheck.ok) return roleCheck.response;
        const idemError = requireIdempotencyKey(req);
        if (idemError) return idemError;

        const body = await req.json();
        const { data, error } = await client
          .from('oracle_evidence_items')
          .insert([body])
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data, 201);
      } else if (req.method === 'PATCH') {
        // UPDATE evidence item
        const roleCheck = await requireRole(auth.claims.userId, 'operator');
        if (!roleCheck.ok) return roleCheck.response;
        const idemError = requireIdempotencyKey(req);
        if (idemError) return idemError;

        const body = await req.json();
        const itemId = body.id;

        if (!itemId) {
          return errorResponse('id required in body', 400);
        }

        const patch = buildSafeEvidenceItemPatch(body as Record<string, unknown>);
        if (Object.keys(patch).length === 1) {
          return errorResponse(
            'No patchable fields provided. Allowed fields: signal_id, source_lane, source_class, source_ref, content_summary, confidence, evidence_strength, source_date, publication_url, author_info, metadata',
            400,
          );
        }

        const { data, error } = await client
          .from('oracle_evidence_items')
          .update(patch)
          .eq('id', itemId)
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
