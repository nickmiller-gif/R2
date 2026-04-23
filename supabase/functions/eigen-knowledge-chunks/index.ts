import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

const supabaseClients = createSupabaseClientFactory();

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
            .select('*')
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

          let query = client.from('knowledge_chunks').select('*');

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
