import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { sanitizeInsert, sanitizeUpdate } from '../_shared/sanitize.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

// Columns the client is allowed to populate on INSERT. `created_by` is
// server-injected from the authenticated JWT; `id`, `created_at`, `updated_at`
// are database-defaulted; internal audit columns are not client-writable.
const INSERT_FIELDS = [
  'linked_table',
  'linked_id',
  'decision_type',
  'title',
  'rationale',
  'outcome',
  'status',
  'decided_by',
  'decided_at',
  'confidence',
  'reviewed_by',
] as const;

// Columns the client is allowed to mutate on PATCH. `linked_table` /
// `linked_id` are immutable once set, and `created_by` can never change.
const UPDATE_FIELDS = [
  'decision_type',
  'title',
  'rationale',
  'outcome',
  'status',
  'decided_by',
  'decided_at',
  'confidence',
  'reviewed_by',
] as const;

const DECISION_COLUMNS =
  'confidence,created_at,created_by,decided_at,decided_by,decision_type,id,linked_id,linked_table,outcome,rationale,reviewed_by,status,title,updated_at';

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
      const id = lastSegment && lastSegment !== 'charter-decisions' ? lastSegment : null;

      const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

      if (req.method === 'GET') {
        if (id) {
          const { data, error } = await client
            .from('charter_decisions')
            .select(DECISION_COLUMNS)
            .eq('id', id)
            .single();

          if (error) {
            return errorResponse(error.message, 404);
          }

          return jsonResponse(data);
        }

        // GET list with optional filters + pagination
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
          .from('charter_decisions')
          .select(DECISION_COLUMNS)
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
          // Server-injected from the authenticated user. Cannot be overridden
          // by the request body — sanitizeInsert applies this AFTER pickFields.
          created_by: auth.claims.userId,
        });

        const { data, error } = await client
          .from('charter_decisions')
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
        // Prefer the URL path id; fall back to body.id for backwards compat.
        // Either way, the id is NEVER taken from the update patch itself.
        const decisionId =
          id ??
          (typeof body === 'object' &&
          body !== null &&
          typeof (body as { id?: unknown }).id === 'string'
            ? (body as { id: string }).id
            : null);

        if (!decisionId) {
          return errorResponse('id required (in path or body)', 400);
        }

        const patch = sanitizeUpdate(body, UPDATE_FIELDS);
        if (Object.keys(patch).length === 0) {
          return errorResponse('No updatable fields in body', 400);
        }

        const { data, error } = await client
          .from('charter_decisions')
          .update(patch)
          .eq('id', decisionId)
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
