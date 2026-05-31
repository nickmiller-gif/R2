import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { pickFields } from '../_shared/sanitize.ts';

const supabaseClients = createSupabaseClientFactory();

// Client-settable columns for writes. Excludes server/db-managed columns
// (`id`, `created_at`, `updated_at`) and the generated `fts` tsvector column.
// Writing those via raw `req.json()` is a mass-assignment vector because the
// edge function uses the service-role client (RLS bypass).
const KNOWLEDGE_CHUNK_INSERT_FIELDS = [
  'document_id',
  'parent_chunk_id',
  'chunk_level',
  'heading_path',
  'entity_ids',
  'policy_tags',
  'valid_from',
  'valid_to',
  'authority_score',
  'freshness_score',
  'provenance_completeness',
  'content',
  'content_hash',
  'embedding',
  'embedding_version',
  'ingestion_run_id',
  'meg_entity_id',
  'oracle_relevance_score',
  'oracle_signal_id',
] as const;

const KNOWLEDGE_CHUNK_UPDATE_FIELDS = KNOWLEDGE_CHUNK_INSERT_FIELDS;

// Explicit `knowledge_chunks` projection so schema additions don't leak through
// `select('*')`. The single-chunk GET (by id) returns the full shape including
// the `embedding` vector for callers that genuinely need it.
const KNOWLEDGE_CHUNKS_SELECT_COLUMNS =
  'authority_score,chunk_level,content,content_hash,created_at,document_id,embedding,embedding_version,entity_ids,freshness_score,fts,heading_path,id,ingestion_run_id,meg_entity_id,oracle_relevance_score,oracle_signal_id,parent_chunk_id,policy_tags,provenance_completeness,updated_at,valid_from,valid_to';

// List (multi-row) projection deliberately omits the heavy server-side-only
// columns `embedding` (1536-dim vector, ~tens of KB serialized per row) and
// `fts` (tsvector). Listing chunks for a document can return hundreds of rows,
// so including the embedding ballooned responses into megabytes. Similarity
// search runs server-side via the `match_knowledge_chunks` RPC, not by reading
// embeddings off this list endpoint; callers that need a specific chunk's
// embedding can fetch it via `?id=`.
const KNOWLEDGE_CHUNKS_LIST_COLUMNS =
  'authority_score,chunk_level,content,content_hash,created_at,document_id,embedding_version,entity_ids,freshness_score,heading_path,id,ingestion_run_id,meg_entity_id,oracle_relevance_score,oracle_signal_id,parent_chunk_id,policy_tags,provenance_completeness,updated_at,valid_from,valid_to';

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

          let query = client.from('knowledge_chunks').select(KNOWLEDGE_CHUNKS_LIST_COLUMNS);

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
        const insertRow = pickFields(body, KNOWLEDGE_CHUNK_INSERT_FIELDS);

        const { data, error } = await client
          .from('knowledge_chunks')
          .insert([insertRow])
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

        const updateRow = {
          ...pickFields(body, KNOWLEDGE_CHUNK_UPDATE_FIELDS),
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await client
          .from('knowledge_chunks')
          .update(updateRow)
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
