import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { sanitizeInsert, sanitizeUpdate } from '../_shared/sanitize.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

const INSERT_FIELDS = [
  'meg_entity_id',
  'charter_entity_id',
  'valuation_kind',
  'amount_numeric',
  'currency',
  'as_of',
  'confidence',
  'methodology',
  'basis_notes',
  'metadata',
  'status',
  'supersedes_id',
] as const;

const UPDATE_FIELDS = [
  'meg_entity_id',
  'charter_entity_id',
  'valuation_kind',
  'amount_numeric',
  'currency',
  'as_of',
  'confidence',
  'methodology',
  'basis_notes',
  'metadata',
  'status',
  'supersedes_id',
  'reviewed_by',
] as const;

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') {
      return corsResponse();
    }

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    try {
      const url = new URL(req.url);
      const pathname = url.pathname;
      const pathSegments = pathname.split('/').filter(Boolean);
      const lastSegment = pathSegments.at(-1);
      const id = lastSegment && lastSegment !== 'charter-asset-valuations' ? lastSegment : null;

      const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

      if (req.method === 'GET') {
        if (id) {
          const { data, error } = await client
            .from('charter_asset_valuations')
            .select(
              'amount_numeric,as_of,basis_notes,charter_entity_id,confidence,created_at,created_by,currency,id,meg_entity_id,metadata,methodology,reviewed_by,status,supersedes_id,updated_at,valuation_kind',
            )
            .eq('id', id)
            .single();

          if (error) {
            return errorResponse(error.message, 404);
          }

          return jsonResponse(data);
        }

        const megEntityId = url.searchParams.get('meg_entity_id');
        const charterEntityId = url.searchParams.get('charter_entity_id');
        const status = url.searchParams.get('status');
        const valuationKind = url.searchParams.get('valuation_kind');
        const limitParam = Math.min(
          200,
          Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '50', 10) || 50),
        );
        const offsetParam = Math.max(
          0,
          Number.parseInt(url.searchParams.get('offset') ?? '0', 10) || 0,
        );

        let query = client
          .from('charter_asset_valuations')
          .select(
            'amount_numeric,as_of,basis_notes,charter_entity_id,confidence,created_at,created_by,currency,id,meg_entity_id,metadata,methodology,reviewed_by,status,supersedes_id,updated_at,valuation_kind',
          )
          .order('as_of', { ascending: false })
          .range(offsetParam, offsetParam + limitParam - 1);

        if (megEntityId) query = query.eq('meg_entity_id', megEntityId);
        if (charterEntityId) query = query.eq('charter_entity_id', charterEntityId);
        if (status) query = query.eq('status', status);
        if (valuationKind) query = query.eq('valuation_kind', valuationKind);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
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
        if (
          row.meg_entity_id == null ||
          typeof row.meg_entity_id !== 'string' ||
          row.valuation_kind == null ||
          typeof row.valuation_kind !== 'string' ||
          row.amount_numeric == null ||
          row.as_of == null ||
          typeof row.as_of !== 'string'
        ) {
          return errorResponse(
            'meg_entity_id, valuation_kind, amount_numeric, as_of are required',
            400,
          );
        }

        const { data, error } = await client
          .from('charter_asset_valuations')
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
        const valuationId =
          id ??
          (typeof body === 'object' &&
          body !== null &&
          typeof (body as { id?: unknown }).id === 'string'
            ? (body as { id: string }).id
            : null);

        if (!valuationId || typeof valuationId !== 'string') {
          return errorResponse('id required in path or body', 400);
        }

        const patch = sanitizeUpdate(body, UPDATE_FIELDS);
        if (Object.keys(patch).length === 0) {
          return errorResponse('No updatable fields in body', 400);
        }

        const { data, error } = await client
          .from('charter_asset_valuations')
          .update(patch)
          .eq('id', valuationId)
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
