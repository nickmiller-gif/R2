import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey, allowlistPayload, safePaginationParams } from '../_shared/validate.ts';
import { extractRequestMeta, metaResponseHeaders } from '../_shared/correlation.ts';

// Columns that may be supplied on CREATE
const GOVERNANCE_CREATE_FIELDS = [
  'kind', 'ref_code', 'title', 'body', 'parent_id',
] as const;

// Columns that may be updated via PATCH
const GOVERNANCE_PATCH_FIELDS = [
  'title', 'body', 'status',
] as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const { correlationId } = extractRequestMeta(req);
  const meta = metaResponseHeaders(correlationId);

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    const id = lastSegment === 'charter-governance' ? null : lastSegment;
    const action = url.searchParams.get('action');

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await client
          .from('charter_governance_entities')
          .select('*')
          .eq('id', id)
          .single();
        if (error) return errorResponse(error.message, 404, meta);
        return jsonResponse(data, 200, meta);
      } else {
        const kind = url.searchParams.get('kind');
        const status = url.searchParams.get('status');
        const refCode = url.searchParams.get('ref_code');
        const { limit, offset } = safePaginationParams(url);

        let query = client.from('charter_governance_entities').select('*');
        if (kind) query = query.eq('kind', kind);
        if (status) query = query.eq('status', status);
        if (refCode) query = query.eq('ref_code', refCode);
        query = query.range(offset, offset + limit - 1);

        const { data, error } = await query;
        if (error) return errorResponse(error.message, 400, meta);
        return jsonResponse(data, 200, meta);
      }
    } else if (req.method === 'POST') {
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;

      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      const raw = await req.json();

      if (action === 'transition') {
        const { entityId, toStatus, reason, actorId } = raw as Record<string, string>;
        if (!entityId || !toStatus || !actorId) {
          return errorResponse('entityId, toStatus, and actorId are required', 400, meta);
        }

        const { data: entity, error: fetchError } = await client
          .from('charter_governance_entities')
          .select('status')
          .eq('id', entityId)
          .single();
        if (fetchError) return errorResponse(fetchError.message, 404, meta);

        const { data: transition, error: transError } = await client
          .from('charter_governance_transitions')
          .insert([{
            entity_id: entityId,
            from_status: entity.status,
            to_status: toStatus,
            reason: reason ?? null,
            actor_id: actorId,
          }])
          .select()
          .single();
        if (transError) return errorResponse(transError.message, 400, meta);

        const { error: updateError } = await client
          .from('charter_governance_entities')
          .update({ status: toStatus, updated_at: new Date().toISOString() })
          .eq('id', entityId);
        if (updateError) return errorResponse(updateError.message, 400, meta);

        return jsonResponse(transition, 200, meta);
      }

      // CREATE governance entity
      const payload = {
        ...allowlistPayload(raw, GOVERNANCE_CREATE_FIELDS),
        created_by: auth.claims.userId,
      };

      const { data, error } = await client
        .from('charter_governance_entities')
        .insert([payload])
        .select()
        .single();
      if (error) return errorResponse(error.message, 400, meta);
      return jsonResponse(data, 201, meta);
    } else if (req.method === 'PATCH') {
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;

      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      const raw = await req.json();
      const entityId = raw.id;
      if (!entityId || typeof entityId !== 'string') return errorResponse('id required in body', 400, meta);

      const patch = {
        ...allowlistPayload(raw, GOVERNANCE_PATCH_FIELDS),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await client
        .from('charter_governance_entities')
        .update(patch)
        .eq('id', entityId)
        .select()
        .single();
      if (error) return errorResponse(error.message, 400, meta);
      return jsonResponse(data, 200, meta);
    } else {
      return errorResponse('Method not allowed', 405, meta);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500, meta);
  }
});
