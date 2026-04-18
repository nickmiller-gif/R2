import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey, allowlistPayload, safePaginationParams } from '../_shared/validate.ts';
import { extractRequestMeta, metaResponseHeaders } from '../_shared/correlation.ts';

// Columns that may be supplied on CREATE
const EVIDENCE_CREATE_FIELDS = [
  'linked_table', 'linked_id', 'evidence_type', 'title', 'storage_path',
  'metadata', 'status', 'confidence', 'canonical_entity_id', 'provenance_record_id',
] as const;

// Columns that may be updated via PATCH
const EVIDENCE_PATCH_FIELDS = [
  'title', 'storage_path', 'metadata', 'status', 'confidence',
  'canonical_entity_id', 'provenance_record_id', 'reviewed_by',
] as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const { correlationId } = extractRequestMeta(req);
  const meta = metaResponseHeaders(correlationId);

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const id = pathname.split('/').pop() === 'charter-evidence' ? null : pathname.split('/').pop();

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await client
          .from('charter_evidence')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          return errorResponse(error.message, 404, meta);
        }

        return jsonResponse(data, 200, meta);
      } else {
        const linkedTable = url.searchParams.get('linked_table');
        const linkedId = url.searchParams.get('linked_id');
        const status = url.searchParams.get('status');
        const { limit, offset } = safePaginationParams(url);

        let query = client.from('charter_evidence').select('*');

        if (linkedTable) query = query.eq('linked_table', linkedTable);
        if (linkedId) query = query.eq('linked_id', linkedId);
        if (status) query = query.eq('status', status);
        query = query.range(offset, offset + limit - 1);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400, meta);
        }

        return jsonResponse(data, 200, meta);
      }
    } else if (req.method === 'POST') {
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;

      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      const raw = await req.json();
      const payload = {
        ...allowlistPayload(raw, EVIDENCE_CREATE_FIELDS),
        created_by: auth.claims.userId,
      };

      const { data, error } = await client
        .from('charter_evidence')
        .insert([payload])
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 400, meta);
      }

      return jsonResponse(data, 201, meta);
    } else if (req.method === 'PATCH') {
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;

      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      const raw = await req.json();
      const evidenceId = raw.id;

      if (!evidenceId || typeof evidenceId !== 'string') {
        return errorResponse('id required in body', 400, meta);
      }

      const patch = {
        ...allowlistPayload(raw, EVIDENCE_PATCH_FIELDS),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await client
        .from('charter_evidence')
        .update(patch)
        .eq('id', evidenceId)
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 400, meta);
      }

      return jsonResponse(data, 200, meta);
    } else {
      return errorResponse('Method not allowed', 405, meta);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500, meta);
  }
});
