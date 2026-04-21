import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { sanitizeUpdate } from '../_shared/sanitize.ts';

// `owner_id`, `id`, `created_at`, and supersede-chain columns must never be
// mutated via the plain PATCH path — that would let a user transfer ownership
// of an entry to another user or break the supersede lineage.
const UPDATE_FIELDS = [
  'scope',
  'key',
  'value',
  'retention_class',
  'expires_at',
  'confidence_band',
  'conflict_group',
] as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const entryId = url.searchParams.get('id');

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (entryId) {
        const { data, error } = await client
          .from('memory_entries')
          .select('*')
          .eq('id', entryId)
          .single();

        if (error) {
          return errorResponse(error.message, 404);
        }

        return jsonResponse(data);
      } else {
        const scope = url.searchParams.get('scope');
        const ownerId = url.searchParams.get('owner_id');
        const key = url.searchParams.get('key');
        const retentionClass = url.searchParams.get('retention_class');

        let query = client.from('memory_entries').select('*');

        if (scope) query = query.eq('scope', scope);
        if (ownerId) query = query.eq('owner_id', ownerId);
        if (key) query = query.eq('key', key);
        if (retentionClass) query = query.eq('retention_class', retentionClass);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      const roleCheck = await requireRole(auth.claims.userId, 'member'); if (!roleCheck.ok) return roleCheck.response;
      const idemError = requireIdempotencyKey(req); if (idemError) return idemError;
      const body = await req.json();

      if (action === 'upsert') {
        if (!body.scope || !body.key || body.value === undefined) {
          return errorResponse('scope, key, and value required in body', 400);
        }

        const upsertPayload = {
          scope: body.scope,
          key: body.key,
          value: body.value,
          retention_class: body.retention_class ?? 'short_term',
          expires_at: body.expires_at ?? null,
          confidence_band: body.confidence_band ?? 'medium',
          conflict_group: body.conflict_group ?? null,
          owner_id: auth.claims.userId,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await client
          .from('memory_entries')
          .upsert([upsertPayload], { onConflict: 'scope,owner_id,key' })
          .select()
          .single();

        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data);
      } else if (action === 'sweep') {
        const now = new Date().toISOString();
        const staleDelete = await client
          .from('memory_entries')
          .delete()
          .eq('owner_id', auth.claims.userId)
          .lt('expires_at', now);

        if (staleDelete.error) return errorResponse(staleDelete.error.message, 400);

        const cutoff = new Date(Date.now() - (1000 * 60 * 60 * 24 * 7)).toISOString();
        const consolidate = await client
          .from('memory_entries')
          .update({
            retention_class: 'long_term',
            updated_at: now,
          })
          .eq('owner_id', auth.claims.userId)
          .eq('retention_class', 'short_term')
          .lt('updated_at', cutoff);

        if (consolidate.error) return errorResponse(consolidate.error.message, 400);

        return jsonResponse({
          action: 'sweep',
          stale_deleted: true,
          consolidated_to_long_term: true,
          swept_at: now,
        });
      } else if (action === 'recall') {
        const scope = typeof body.scope === 'string' ? body.scope : null;
        const keyPattern = typeof body.key_pattern === 'string' ? body.key_pattern : null;
        const limit = typeof body.limit === 'number' ? Math.max(1, Math.min(100, body.limit)) : 20;

        let query = client
          .from('memory_entries')
          .select('*')
          .eq('owner_id', auth.claims.userId)
          .order('updated_at', { ascending: false })
          .limit(limit);

        if (scope) query = query.eq('scope', scope);
        if (keyPattern) query = query.ilike('key', `${keyPattern}%`);

        const { data, error } = await query;
        if (error) return errorResponse(error.message, 400);

        return jsonResponse({
          action: 'recall',
          count: data?.length ?? 0,
          entries: data ?? [],
        });
      } else if (action === 'supersede') {
        const id = body.id;
        const newId = body.new_id;

        if (!id || !newId) {
          return errorResponse('id and new_id required in body', 400);
        }

        const { data, error } = await client
          .from('memory_entries')
          .update({ superseded_by: newId })
          .eq('id', id)
          .eq('owner_id', auth.claims.userId)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      } else {
        if (!body.scope || !body.key || body.value === undefined) {
          return errorResponse('scope, key, and value required in body', 400);
        }

        const payload = {
          scope: body.scope,
          key: body.key,
          value: body.value,
          retention_class: body.retention_class ?? 'short_term',
          expires_at: body.expires_at ?? null,
          confidence_band: body.confidence_band ?? 'medium',
          conflict_group: body.conflict_group ?? null,
          owner_id: auth.claims.userId,
        };

        const { data, error } = await client
          .from('memory_entries')
          .insert([payload])
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data, 201);
      }
    } else if (req.method === 'PATCH') {
      const roleCheck = await requireRole(auth.claims.userId, 'member'); if (!roleCheck.ok) return roleCheck.response;
      const idemError = requireIdempotencyKey(req); if (idemError) return idemError;
      const body = await req.json();
      const id = body.id;

      if (!id) {
        return errorResponse('id required in body', 400);
      }

      const patch = sanitizeUpdate(body, UPDATE_FIELDS);
      if (Object.keys(patch).length === 0) {
        return errorResponse('No updatable fields in body', 400);
      }

      const { data, error } = await client
        .from('memory_entries')
        .update(patch)
        .eq('id', id)
        .eq('owner_id', auth.claims.userId)
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 400);
      }

      return jsonResponse(data);
    } else {
      return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
