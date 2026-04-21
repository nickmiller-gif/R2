import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { sanitizeInsert } from '../_shared/sanitize.ts';
import { buildSafeEvidenceItemPatch } from '../../../src/services/oracle/oracle-patch-builders.ts';

// Columns the client may populate on CREATE. `profile_id` is server-injected
// from the JWT so operators cannot attribute evidence to another user. DB
// defaults cover timestamps and the jsonb metadata columns.
const EVIDENCE_INSERT_FIELDS = [
  'signal_id',
  'source_lane',
  'source_class',
  'source_ref',
  'content_summary',
  'confidence',
  'evidence_strength',
  'source_date',
  'publication_url',
  'author_info',
  'metadata',
] as const;

const supabaseClients = createSupabaseClientFactory();

Deno.serve(async (req) => {
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
          .select('*')
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

        let query = client.from('oracle_evidence_items').select('*');

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
      const row = sanitizeInsert(body, EVIDENCE_INSERT_FIELDS, {
        profile_id: auth.claims.userId,
      });

      const { data, error } = await client
        .from('oracle_evidence_items')
        .insert([row])
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
});
