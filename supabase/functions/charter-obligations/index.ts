import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey, allowlistPayload, safePaginationParams } from '../_shared/validate.ts';
import { extractRequestMeta, metaResponseHeaders } from '../_shared/correlation.ts';

// Columns that may be supplied on CREATE
const OBLIGATION_CREATE_FIELDS = [
  'entity_id', 'right_id', 'obligation_type', 'title', 'description',
  'due_date', 'status', 'confidence',
] as const;

// Columns that may be updated via PATCH
const OBLIGATION_PATCH_FIELDS = [
  'title', 'description', 'due_date', 'status', 'confidence', 'reviewed_by',
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
    const id = pathname.split('/').pop() === 'charter-obligations' ? null : pathname.split('/').pop();

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await client
          .from('charter_obligations')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          return errorResponse(error.message, 404, meta);
        }

        return jsonResponse(data, 200, meta);
      } else {
        const entityId = url.searchParams.get('entity_id');
        const status = url.searchParams.get('status');
        const { limit, offset } = safePaginationParams(url);

        let query = client.from('charter_obligations').select('*');

        if (entityId) query = query.eq('entity_id', entityId);
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
        ...allowlistPayload(raw, OBLIGATION_CREATE_FIELDS),
        created_by: auth.claims.userId,
      };

      const { data, error } = await client
        .from('charter_obligations')
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
      const obligationId = raw.id;

      if (!obligationId || typeof obligationId !== 'string') {
        return errorResponse('id required in body', 400, meta);
      }

      const patch = {
        ...allowlistPayload(raw, OBLIGATION_PATCH_FIELDS),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await client
        .from('charter_obligations')
        .update(patch)
        .eq('id', obligationId)
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
