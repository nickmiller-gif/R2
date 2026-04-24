import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

const supabaseClients = createSupabaseClientFactory();

// Explicit `knowledge_chunks` projection so schema additions don't leak through
// `select('*')`. `embedding` is kept to preserve current response shape even
// though it balloons payloads — trimming it would be a separate API-level
// change (see operator read-model follow-ups).
const KNOWLEDGE_CHUNKS_SELECT_COLUMNS =
  'authority_score,chunk_level,content,content_hash,created_at,document_id,embedding,embedding_version,entity_ids,freshness_score,fts,heading_path,id,ingestion_run_id,meg_entity_id,oracle_relevance_score,oracle_signal_id,parent_chunk_id,policy_tags,provenance_completeness,updated_at,valid_from,valid_to';

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') {
      return corsResponse();
    }

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    try {
      const url = new URL(req.url);
      const chunkId = url.searchParams.get('id');

      const client = req.method === 'GET' ? supabaseClients.user(req) : supabaseClients.service();

      if (req.method === 'GET') {
        if (chunkId) {
          const { data, error } = await client
            .from('knowledge_chunks')
            .select(KNOWLEDGE_CHUNKS_SELECT_COLUMNS)
            .eq('id', chunkId)
            .single();

          if (error) {
            return errorResponse(error.message, 404);
          }

          return jsonResponse(data);
        } else {
          const documentId = url.searchParams.get('document_id');
          const chunkLevel = url.searchParams.get('chunk_level');
          const parentChunkId = url.searchParams.get('parent_chunk_id');

          let query = client.from('knowledge_chunks').select(KNOWLEDGE_CHUNKS_SELECT_COLUMNS);

          if (documentId) query = query.eq('document_id', documentId);
          if (chunkLevel) query = query.eq('chunk_level', chunkLevel);
          if (parentChunkId) query = query.eq('parent_chunk_id', parentChunkId);

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

        const { data, error } = await client
          .from('knowledge_chunks')
          .insert([body])
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data, 201);
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
          .from('knowledge_chunks')
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
