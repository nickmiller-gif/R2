import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { sanitizeInsert, sanitizeUpdate } from '../_shared/sanitize.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

const INSERT_FIELDS = [
  'entity_type',
  'name',
  'metadata',
  'status',
  'confidence',
  'source_platform',
  'source_record_id',
  'canonical_entity_id',
  'context_status',
  'reviewed_by',
] as const;

const UPDATE_FIELDS = [
  'entity_type',
  'name',
  'metadata',
  'status',
  'confidence',
  'source_platform',
  'source_record_id',
  'canonical_entity_id',
  'context_status',
  'last_context_sync_at',
  'reviewed_by',
] as const;

const ENTITY_COLUMNS =
  'canonical_entity_id,confidence,context_status,created_at,created_by,entity_type,id,last_context_sync_at,metadata,name,reviewed_by,source_platform,source_record_id,status,updated_at';

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 500;

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') {
      return corsResponse();
    }

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    try {
      const url = new URL(req.url);
      const segments = url.pathname.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      const id = lastSegment && lastSegment !== 'charter-entities' ? lastSegment : null;

      const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

      if (req.method === 'GET') {
        if (id) {
          const { data, error } = await client
            .from('charter_entities')
            .select(ENTITY_COLUMNS)
            .eq('id', id)
            .single();

          if (error) {
            return errorResponse(error.message, 404);
          }

          return jsonResponse(data);
        }

        const entityType = url.searchParams.get('entity_type');
        const status = url.searchParams.get('status');
        const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
        const offsetRaw = Number.parseInt(url.searchParams.get('offset') ?? '', 10);
        const limit = Number.isFinite(limitRaw)
          ? Math.min(Math.max(limitRaw, 1), MAX_LIST_LIMIT)
          : DEFAULT_LIST_LIMIT;
        const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

        let query = client
          .from('charter_entities')
          .select(ENTITY_COLUMNS)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (entityType) query = query.eq('entity_type', entityType);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse({ rows: data, limit, offset });
      }

      if (req.method === 'POST') {
        const roleCheck = await requireRole(auth.claims.userId, 'operator');
        if (!roleCheck.ok) return roleCheck.response;

        const idemError = requireIdempotencyKey(req);
        if (idemError) return idemError;

        const body = await req.json();
        const row = sanitizeInsert(body, INSERT_FIELDS, {
          created_by: auth.claims.userId,
        });

        const { data, error } = await client
          .from('charter_entities')
          .insert([row])
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

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
          (typeof body === 'object' &&
          body !== null &&
          typeof (body as { id?: unknown }).id === 'string'
            ? (body as { id: string }).id
            : null);

        if (!entityId) {
          return errorResponse('id required (in path or body)', 400);
        }

        const patch = sanitizeUpdate(body, UPDATE_FIELDS);
        if (Object.keys(patch).length === 0) {
          return errorResponse('No updatable fields in body', 400);
        }

        const { data, error } = await client
          .from('charter_entities')
          .update(patch)
          .eq('id', entityId)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }

      return errorResponse('Method not allowed', 405);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return errorResponse(message, 500);
    }
  }),
);
