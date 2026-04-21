import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { sanitizeInsert, sanitizeUpdate } from '../_shared/sanitize.ts';

// documents table: intent is that `owner_id` is the document's owner.
// Creating operators may legitimately ingest on behalf of someone else, so
// owner_id stays client-settable (the RLS layer + GET/PATCH filters enforce
// read-access downstream). `created_by`-style columns are not present on
// this table, so we only strip system-managed fields here.
const INSERT_FIELDS = [
  'title',
  'description',
  'source_system',
  'source_ref',
  'owner_id',
  'status',
  'index_status',
  'embedding_status',
  'vector_store_ref',
  'storage_path',
  'storage_bucket',
  'mime_type',
  'metadata',
  'tags',
] as const;

const UPDATE_FIELDS = [
  'title',
  'description',
  'status',
  'index_status',
  'embedding_status',
  'vector_store_ref',
  'storage_path',
  'storage_bucket',
  'mime_type',
  'metadata',
  'tags',
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
    const docId = url.searchParams.get('id');

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (docId) {
        const { data, error } = await client
          .from('documents')
          .select('*')
          .eq('id', docId)
          .single();

        if (error) {
          return errorResponse(error.message, 404);
        }

        return jsonResponse(data);
      } else {
        const sourceSystem = url.searchParams.get('source_system');
        const ownerId = url.searchParams.get('owner_id');
        const status = url.searchParams.get('status');
        const indexStatus = url.searchParams.get('index_status');

        let query = client.from('documents').select('*');

        if (sourceSystem) query = query.eq('source_system', sourceSystem);
        if (ownerId) query = query.eq('owner_id', ownerId);
        if (status) query = query.eq('status', status);
        if (indexStatus) query = query.eq('index_status', indexStatus);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      const roleCheck = await requireRole(auth.claims.userId, 'operator'); if (!roleCheck.ok) return roleCheck.response;
      const idemError = requireIdempotencyKey(req); if (idemError) return idemError;
      const body = await req.json();

      if (action === 'mark_indexed') {
        const id = body.id;
        if (!id) {
          return errorResponse('id required in body', 400);
        }

        const patch: Record<string, unknown> = {
          index_status: 'indexed',
          indexed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (body.vector_store_ref) patch.vector_store_ref = body.vector_store_ref;

        const { data, error } = await client
          .from('documents')
          .update(patch)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      } else if (action === 'mark_embedded') {
        const id = body.id;
        if (!id || !body.vector_store_ref) {
          return errorResponse('id and vector_store_ref required', 400);
        }

        const { data, error } = await client
          .from('documents')
          .update({
            embedding_status: 'embedded',
            vector_store_ref: body.vector_store_ref,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      } else {
        // CREATE document
        const row = sanitizeInsert(body, INSERT_FIELDS, {});
        const { data, error } = await client
          .from('documents')
          .insert([row])
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data, 201);
      }
    } else if (req.method === 'PATCH') {
      const roleCheck = await requireRole(auth.claims.userId, 'operator'); if (!roleCheck.ok) return roleCheck.response;
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
        .from('documents')
        .update(patch)
        .eq('id', id)
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
