import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { sanitizeInsert, sanitizeUpdate } from '../_shared/sanitize.ts';

const INSERT_FIELDS = ['kind', 'status', 'ref_code', 'title', 'body', 'version', 'parent_id'] as const;
const UPDATE_FIELDS = ['status', 'ref_code', 'title', 'body', 'version', 'parent_id'] as const;

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 500;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    const id = lastSegment && lastSegment !== 'charter-governance' ? lastSegment : null;
    const action = url.searchParams.get('action');

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await client
          .from('charter_governance_entities')
          .select('*')
          .eq('id', id)
          .single();
        if (error) return errorResponse(error.message, 404);
        return jsonResponse(data);
      }

      const kind = url.searchParams.get('kind');
      const status = url.searchParams.get('status');
      const refCode = url.searchParams.get('ref_code');
      const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
      const offsetRaw = Number.parseInt(url.searchParams.get('offset') ?? '', 10);
      const limit = Number.isFinite(limitRaw)
        ? Math.min(Math.max(limitRaw, 1), MAX_LIST_LIMIT)
        : DEFAULT_LIST_LIMIT;
      const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

      let query = client
        .from('charter_governance_entities')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (kind) query = query.eq('kind', kind);
      if (status) query = query.eq('status', status);
      if (refCode) query = query.eq('ref_code', refCode);

      const { data, error } = await query;
      if (error) return errorResponse(error.message, 400);
      return jsonResponse({ rows: data, limit, offset });
    }

    if (req.method === 'POST') {
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;

      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      const body = await req.json();

      if (action === 'transition') {
        const entityId =
          typeof body === 'object' && body !== null && typeof (body as { entityId?: unknown }).entityId === 'string'
            ? (body as { entityId: string }).entityId
            : null;
        const toStatus =
          typeof body === 'object' && body !== null && typeof (body as { toStatus?: unknown }).toStatus === 'string'
            ? (body as { toStatus: string }).toStatus
            : null;
        const reason =
          typeof body === 'object' && body !== null && typeof (body as { reason?: unknown }).reason === 'string'
            ? (body as { reason: string }).reason
            : null;

        if (!entityId || !toStatus) {
          return errorResponse('entityId and toStatus are required', 400);
        }

        const { data: entity, error: fetchError } = await client
          .from('charter_governance_entities')
          .select('status')
          .eq('id', entityId)
          .single();
        if (fetchError) return errorResponse(fetchError.message, 404);

        const { data: transition, error: transError } = await client
          .from('charter_governance_transitions')
          .insert([
            {
              entity_id: entityId,
              from_status: entity.status,
              to_status: toStatus,
              reason,
              // Authenticated JWT user_id, never the client body. A transition
              // log entry is audit-critical — the actor must be the caller.
              actor_id: auth.claims.userId,
            },
          ])
          .select()
          .single();
        if (transError) return errorResponse(transError.message, 400);

        const { error: updateError } = await client
          .from('charter_governance_entities')
          .update({ status: toStatus, updated_at: new Date().toISOString() })
          .eq('id', entityId);
        if (updateError) return errorResponse(updateError.message, 400);

        return jsonResponse(transition);
      }

      // CREATE governance entity
      const row = sanitizeInsert(body, INSERT_FIELDS, {
        created_by: auth.claims.userId,
      });

      const { data, error } = await client
        .from('charter_governance_entities')
        .insert([row])
        .select()
        .single();
      if (error) return errorResponse(error.message, 400);
      return jsonResponse(data, 201);
    }

    if (req.method === 'PATCH') {
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;

      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      const body = await req.json();
      const entityId =
        id ??
        (typeof body === 'object' && body !== null && typeof (body as { id?: unknown }).id === 'string'
          ? (body as { id: string }).id
          : null);
      if (!entityId) return errorResponse('id required (in path or body)', 400);

      const patch = sanitizeUpdate(body, UPDATE_FIELDS);
      if (Object.keys(patch).length === 0) {
        return errorResponse('No updatable fields in body', 400);
      }

      const { data, error } = await client
        .from('charter_governance_entities')
        .update(patch)
        .eq('id', entityId)
        .select()
        .single();
      if (error) return errorResponse(error.message, 400);
      return jsonResponse(data);
    }

    return errorResponse('Method not allowed', 405);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
