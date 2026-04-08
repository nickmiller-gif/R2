import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardJwt } from '../_shared/jwt.ts';

/**
 * Ingest Document Edge Function
 *
 * Takes a document ID, splits its body into knowledge_chunks using recursive
 * character splitting, and inserts them. The existing trigger on knowledge_chunks
 * automatically enqueues embedding jobs via pgmq.
 *
 * Flow: ingest-document → knowledge_chunks INSERT → trigger → pgmq → embed-chunks
 *
 * POST /functions/v1/ingest-document
 * Body: { document_id: string, max_tokens?: number, overlap_tokens?: number }
 */

const DEFAULT_MAX_TOKENS = 384;
const DEFAULT_OVERLAP_RATIO = 0.1;
const CHARS_PER_TOKEN = 4;

const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' '];

interface IngestRequest {
  document_id: string;
  max_tokens?: number;
  overlap_tokens?: number;
}

interface TextChunk {
  content: string;
  index: number;
}

function splitRecursive(text: string, separators: string[], maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  for (const sep of separators) {
    const parts = text.split(sep);
    if (parts.length <= 1) continue;

    const merged: string[] = [];
    let current = '';
    for (let i = 0; i < parts.length; i++) {
      const withSep = i < parts.length - 1 ? parts[i] + sep : parts[i];
      if (current.length + withSep.length <= maxChars) {
        current += withSep;
      } else {
        if (current.length > 0) merged.push(current);
        current = withSep;
      }
    }
    if (current.length > 0) merged.push(current);

    const result: string[] = [];
    const remaining = separators.slice(separators.indexOf(sep) + 1);
    for (const chunk of merged) {
      if (chunk.length <= maxChars) {
        result.push(chunk);
      } else if (remaining.length > 0) {
        result.push(...splitRecursive(chunk, remaining, maxChars));
      } else {
        for (let i = 0; i < chunk.length; i += maxChars) {
          result.push(chunk.slice(i, i + maxChars));
        }
      }
    }
    return result;
  }

  const result: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    result.push(text.slice(i, i + maxChars));
  }
  return result;
}

function chunkText(text: string, maxTokens: number, overlapTokens: number): TextChunk[] {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  if (text.length <= maxChars) {
    return [{ content: text, index: 0 }];
  }

  const raw = splitRecursive(text, DEFAULT_SEPARATORS, maxChars);

  // Add overlap from previous chunk
  const chunks: TextChunk[] = [];
  for (let i = 0; i < raw.length; i++) {
    let content = raw[i];
    if (i > 0 && overlapChars > 0) {
      const overlap = raw[i - 1].slice(-overlapChars);
      if (overlap.length + content.length <= maxChars) {
        content = overlap + content;
      }
    }
    chunks.push({ content, index: i });
  }

  return chunks;
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  // Verify JWT signature and extract caller identity for ownership check
  const auth = await guardJwt(req);
  if (!auth.ok) {
    return errorResponse(`Unauthorized: ${auth.error}`, 401);
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const body: IngestRequest = await req.json();
    const { document_id } = body;

    if (!document_id) {
      return errorResponse('document_id is required', 400);
    }

    const maxTokens = body.max_tokens ?? DEFAULT_MAX_TOKENS;
    const overlapTokens = body.overlap_tokens ?? Math.floor(maxTokens * DEFAULT_OVERLAP_RATIO);

    const client = getServiceClient();

    // 1. Fetch the document
    const { data: doc, error: docError } = await client
      .from('documents')
      .select('id, body, title, owner_id, content_hash, status')
      .eq('id', document_id)
      .single();

    if (docError || !doc) {
      return errorResponse(`Document not found: ${docError?.message ?? 'no data'}`, 404);
    }

    // Authorization: the authenticated caller must own this document
    if (doc.owner_id !== auth.payload.sub) {
      return errorResponse('Forbidden: you do not own this document', 403);
    }

    if (doc.status !== 'active') {
      return errorResponse(`Document status is '${doc.status}', expected 'active'`, 400);
    }

    if (!doc.body || doc.body.trim().length === 0) {
      return errorResponse('Document body is empty', 400);
    }

    // 2. Delete existing chunks for this document (re-ingestion)
    const { error: deleteError } = await client
      .from('knowledge_chunks')
      .delete()
      .eq('document_id', document_id);

    if (deleteError) {
      return errorResponse(`Failed to clear existing chunks: ${deleteError.message}`, 500);
    }

    // 3. Chunk the document body
    const textChunks = chunkText(doc.body, maxTokens, overlapTokens);

    // 4. Build the document-level chunk first
    const ingestionRunId = crypto.randomUUID();
    const now = new Date().toISOString();

    const docChunkContent = doc.title + (doc.body.length > 500 ? '\n\n' + doc.body.slice(0, 500) + '...' : '\n\n' + doc.body);
    const docChunkHash = await sha256(docChunkContent);
    const docChunkRow = {
      document_id,
      chunk_level: 'document',
      heading_path: [doc.title],
      entity_ids: [],
      policy_tags: [],
      content: docChunkContent,
      content_hash: docChunkHash,
      embedding_version: null,
      ingestion_run_id: ingestionRunId,
    };

    const { data: docChunk, error: docChunkError } = await client
      .from('knowledge_chunks')
      .insert([docChunkRow])
      .select('id')
      .single();

    if (docChunkError) {
      return errorResponse(`Failed to create document chunk: ${docChunkError.message}`, 500);
    }

    // 5. Insert paragraph-level chunks
    const chunkRows = await Promise.all(
      textChunks.map(async (chunk) => ({
        document_id,
        parent_chunk_id: docChunk.id,
        chunk_level: 'paragraph',
        heading_path: [doc.title],
        entity_ids: [],
        policy_tags: [],
        content: chunk.content,
        content_hash: await sha256(chunk.content),
        embedding_version: null,
        ingestion_run_id: ingestionRunId,
      })),
    );

    const { data: insertedChunks, error: insertError } = await client
      .from('knowledge_chunks')
      .insert(chunkRows)
      .select('id');

    if (insertError) {
      return errorResponse(`Failed to insert chunks: ${insertError.message}`, 500);
    }

    // 6. Update document indexing lifecycle
    const { error: updateError } = await client
      .from('documents')
      .update({
        index_status: 'indexed',
        indexed_at: now,
        embedding_status: 'pending',
        updated_at: now,
      })
      .eq('id', document_id);

    if (updateError) {
      return errorResponse(`Failed to update document status: ${updateError.message}`, 500);
    }

    return jsonResponse({
      document_id,
      ingestion_run_id: ingestionRunId,
      document_chunk_id: docChunk.id,
      paragraph_chunks: insertedChunks?.length ?? 0,
      total_chunks: (insertedChunks?.length ?? 0) + 1,
      max_tokens: maxTokens,
      overlap_tokens: overlapTokens,
    }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
