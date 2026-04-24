import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

// Explicit `documents` projection so GET responses are stable across schema
// additions. New columns must be added here deliberately rather than leaking
// through a `select('*')` wildcard (advisor lint 0022).
const DOCUMENTS_SELECT_COLUMNS =
  'body,captured_at,confidence,content_hash,content_type,created_at,embedding_status,entities_mentioned,extracted_text_status,file_path,file_size_bytes,file_url,id,index_status,indexed_at,meg_canonical_id,meg_entity_id,mime_type,owner_id,related_entity_id,related_entity_type,rights_constraints,source_authority_tier,source_license,source_ref,source_system,source_title,source_type,source_url,status,storage_bucket,storage_path,summary,tags,title,updated_at,user_id,vector_store_ref,visibility';

Deno.serve(
  withRequestMeta(async (req) => {
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
            .select(DOCUMENTS_SELECT_COLUMNS)
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

          let query = client.from('documents').select(DOCUMENTS_SELECT_COLUMNS);

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
        const roleCheck = await requireRole(auth.claims.userId, 'operator');
        if (!roleCheck.ok) return roleCheck.response;
        const idemError = requireIdempotencyKey(req);
        if (idemError) return idemError;
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
          const { data, error } = await client.from('documents').insert([body]).select().single();

          if (error) {
            return errorResponse(error.message, 400);
          }

          return jsonResponse(data, 201);
        }
      } else if (req.method === 'PATCH') {
        const roleCheck = await requireRole(auth.claims.userId, 'operator');
        if (!roleCheck.ok) return roleCheck.response;
        const idemError = requireIdempotencyKey(req);
        if (idemError) return idemError;
        const body = await req.json();
        const id = body.id;

        if (!id) {
          return errorResponse('id required in body', 400);
        }

        const { data, error } = await client
          .from('documents')
          .update(body)
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
  }),
);
