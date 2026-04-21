import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { sanitizeInsert, sanitizeUpdate } from '../_shared/sanitize.ts';

const INSERT_FIELDS = [
  'entity_id',
  'right_id',
  'obligation_id',
  'amount',
  'currency',
  'payout_date',
  'status',
  'confidence',
  'reviewed_by',
] as const;

// `status`, `approved_by`, and `amount` are deliberately excluded from the
// normal update path so approve-flow is the only way to move into "approved"
// and the approver is always the server-identified caller.
const UPDATE_FIELDS = [
  'amount',
  'currency',
  'payout_date',
  'status',
  'entity_id',
  'right_id',
  'obligation_id',
  'confidence',
  'reviewed_by',
] as const;

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 500;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    const id = lastSegment && lastSegment !== 'charter-payouts' && lastSegment !== 'approve'
      ? lastSegment
      : null;
    const isApproveAction = lastSegment === 'approve';

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await client
          .from('charter_payouts')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          return errorResponse(error.message, 404);
        }

        return jsonResponse(data);
      }

      const entityId = url.searchParams.get('entity_id');
      const status = url.searchParams.get('status');
      const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
      const offsetRaw = Number.parseInt(url.searchParams.get('offset') ?? '', 10);
      const limit = Number.isFinite(limitRaw)
        ? Math.min(Math.max(limitRaw, 1), MAX_LIST_LIMIT)
        : DEFAULT_LIST_LIMIT;
      const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

      let query = client
        .from('charter_payouts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (entityId) query = query.eq('entity_id', entityId);
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

      // POST /charter-payouts/approve — moves a payout to status='approved'
      // and records the APPROVER from the authenticated JWT, never from the
      // request body. The body need only carry the payout id.
      if (isApproveAction) {
        const body = await req.json();
        const payoutId =
          typeof body === 'object' && body !== null && typeof (body as { id?: unknown }).id === 'string'
            ? (body as { id: string }).id
            : null;

        if (!payoutId) {
          return errorResponse('id required in body', 400);
        }

        const { data, error } = await client
          .from('charter_payouts')
          .update({
            status: 'approved',
            approved_by: auth.claims.userId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', payoutId)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }

      // CREATE payout
      const body = await req.json();
      const row = sanitizeInsert(body, INSERT_FIELDS, {
        created_by: auth.claims.userId,
      });

      const { data, error } = await client
        .from('charter_payouts')
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
      const payoutId =
        id ??
        (typeof body === 'object' && body !== null && typeof (body as { id?: unknown }).id === 'string'
          ? (body as { id: string }).id
          : null);

      if (!payoutId) {
        return errorResponse('id required (in path or body)', 400);
      }

      const patch = sanitizeUpdate(body, UPDATE_FIELDS);
      if (Object.keys(patch).length === 0) {
        return errorResponse('No updatable fields in body', 400);
      }

      const { data, error } = await client
        .from('charter_payouts')
        .update(patch)
        .eq('id', payoutId)
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
});
