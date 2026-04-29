import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { sanitizeInsert, sanitizeUpdate } from '../_shared/sanitize.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

const INSERT_FIELDS = [
  'linked_table',
  'linked_id',
  'evidence_type',
  'title',
  'storage_path',
  'metadata',
  'status',
  'confidence',
  'canonical_entity_id',
  'provenance_record_id',
  'reviewed_by',
] as const;

const UPDATE_FIELDS = [
  'evidence_type',
  'title',
  'storage_path',
  'metadata',
  'status',
  'confidence',
  'canonical_entity_id',
  'provenance_record_id',
  'reviewed_by',
] as const;

const EVIDENCE_COLUMNS =
  'canonical_entity_id,confidence,created_at,created_by,evidence_type,id,linked_id,linked_table,metadata,provenance_record_id,reviewed_by,status,storage_path,title,updated_at';

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
      const id = lastSegment && lastSegment !== 'charter-evidence' ? lastSegment : null;

      const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

      if (req.method === 'GET') {
        if (id) {
          const { data, error } = await client
            .from('charter_evidence')
            .select(EVIDENCE_COLUMNS)
            .eq('id', id)
            .single();

          if (error) {
            return errorResponse(error.message, 404);
          }

          return jsonResponse(data);
        }

        const linkedTable = url.searchParams.get('linked_table');
        const linkedId = url.searchParams.get('linked_id');
        const status = url.searchParams.get('status');
        const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
        const offsetRaw = Number.parseInt(url.searchParams.get('offset') ?? '', 10);
        const limit = Number.isFinite(limitRaw)
          ? Math.min(Math.max(limitRaw, 1), MAX_LIST_LIMIT)
          : DEFAULT_LIST_LIMIT;
        const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

        let query = client
          .from('charter_evidence')
          .select(EVIDENCE_COLUMNS)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (linkedTable) query = query.eq('linked_table', linkedTable);
        if (linkedId) query = query.eq('linked_id', linkedId);
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
          .from('charter_evidence')
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
        const evidenceId =
          id ??
          (typeof body === 'object' &&
          body !== null &&
          typeof (body as { id?: unknown }).id === 'string'
            ? (body as { id: string }).id
            : null);

        if (!evidenceId) {
          return errorResponse('id required (in path or body)', 400);
        }

        const patch = sanitizeUpdate(body, UPDATE_FIELDS);
        if (Object.keys(patch).length === 0) {
          return errorResponse('No updatable fields in body', 400);
        }

        const { data, error } = await client
          .from('charter_evidence')
          .update(patch)
          .eq('id', evidenceId)
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
