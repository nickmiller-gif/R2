import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { sanitizeInsert } from '../_shared/sanitize.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

// Provenance is append-only (migration 202604020002 creates the no_update /
// no_delete rules). The actor_id is ALWAYS the authenticated caller —
// provenance is the immutable audit trail, so letting the client declare the
// actor would defeat the table's purpose.
const INSERT_FIELDS = [
  'entity_id',
  'event_type',
  'actor_kind',
  'payload_hash',
  'chain_hash',
  'metadata',
  'domain',
] as const;

const PROVENANCE_COLUMNS =
  'actor_id,actor_kind,chain_hash,domain,entity_id,event_type,id,metadata,payload_hash,recorded_at';

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 1000;

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    try {
      const url = new URL(req.url);
      const segments = url.pathname.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      const id = lastSegment && lastSegment !== 'charter-provenance' ? lastSegment : null;

      const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

      if (req.method === 'GET') {
        if (id) {
          const { data, error } = await client
            .from('charter_provenance_events')
            .select(PROVENANCE_COLUMNS)
            .eq('id', id)
            .single();
          if (error) return errorResponse(error.message, 404);
          return jsonResponse(data);
        }

        const entityId = url.searchParams.get('entity_id');
        const eventType = url.searchParams.get('event_type');
        const actorId = url.searchParams.get('actor_id');
        const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
        const offsetRaw = Number.parseInt(url.searchParams.get('offset') ?? '', 10);
        const limit = Number.isFinite(limitRaw)
          ? Math.min(Math.max(limitRaw, 1), MAX_LIST_LIMIT)
          : DEFAULT_LIST_LIMIT;
        const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

        let query = client
          .from('charter_provenance_events')
          .select(PROVENANCE_COLUMNS)
          .order('recorded_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (entityId) query = query.eq('entity_id', entityId);
        if (eventType) query = query.eq('event_type', eventType);
        if (actorId) query = query.eq('actor_id', actorId);

        const { data, error } = await query;
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ rows: data, limit, offset });
      }

      if (req.method === 'POST') {
        // APPEND provenance event (immutable — no PATCH or DELETE possible)
        const roleCheck = await requireRole(auth.claims.userId, 'operator');
        if (!roleCheck.ok) return roleCheck.response;

        const idemError = requireIdempotencyKey(req);
        if (idemError) return idemError;

        const body = await req.json();
        const row = sanitizeInsert(body, INSERT_FIELDS, {
          // actor_id is the authenticated caller, never supplied by the client.
          actor_id: auth.claims.userId,
        });

        const { data, error } = await client
          .from('charter_provenance_events')
          .insert([row])
          .select()
          .single();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data, 201);
      }

      return errorResponse('Method not allowed', 405);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return errorResponse(message, 500);
    }
  }),
);
