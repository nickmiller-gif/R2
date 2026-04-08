import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardJwt } from '../_shared/jwt.ts';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS = 1536;
const OPENAI_URL = 'https://api.openai.com/v1/embeddings';

interface EmbeddingJobPayload {
  chunk_id: string;
  document_id: string;
  content_hash: string;
  chunk_level: string;
  op: string;
}

interface PgmqMessage {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: EmbeddingJobPayload;
}

interface JobResult {
  chunk_id: string;
  status: 'embedded' | 'skipped' | 'failed';
  error?: string;
}

/**
 * Generate embeddings for a batch of text inputs via OpenAI.
 */
async function generateEmbeddings(
  texts: string[],
  apiKey: string,
): Promise<number[][]> {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMS,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.data.map((item: { embedding: number[] }) => item.embedding);
}

/**
 * Process a batch of embedding jobs from pgmq.
 *
 * For each message:
 * 1. Check idempotency log — skip if already processed
 * 2. Fetch chunk content from knowledge_chunks
 * 3. Generate embedding via OpenAI
 * 4. Write embedding + version back to knowledge_chunks
 * 5. Record in idempotency log
 * 6. Delete message from queue (ack)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  // Verify JWT signature and require service_role — this endpoint is internal
  // (called by pg_cron dispatcher) and performs service-role writes.
  const auth = await guardJwt(req);
  if (!auth.ok) {
    return errorResponse(`Unauthorized: ${auth.error}`, 401);
  }
  if (auth.payload.role !== 'service_role') {
    return errorResponse('Forbidden: service_role required', 403);
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return errorResponse('OPENAI_API_KEY not configured', 500);
  }

  try {
    const { messages } = (await req.json()) as { messages: PgmqMessage[] };

    if (!messages || messages.length === 0) {
      return jsonResponse({ results: [], message: 'No messages to process' });
    }

    const client = getServiceClient();
    const results: JobResult[] = [];

    // Collect chunk IDs and check idempotency in batch
    const jobs = messages.map((m) => m.message);
    const chunkIds = jobs.map((j) => j.chunk_id);

    // Fetch all chunks in one query
    const { data: chunks, error: fetchError } = await client
      .from('knowledge_chunks')
      .select('id, content, content_hash')
      .in('id', chunkIds);

    if (fetchError) {
      return errorResponse(`Failed to fetch chunks: ${fetchError.message}`, 500);
    }

    const chunkMap = new Map(
      (chunks ?? []).map((c: { id: string; content: string; content_hash: string }) => [c.id, c]),
    );

    // Check idempotency log in batch
    const { data: alreadyProcessed } = await client
      .from('embedding_job_log')
      .select('chunk_id, content_hash')
      .in('chunk_id', chunkIds);

    const processedSet = new Set(
      (alreadyProcessed ?? []).map(
        (r: { chunk_id: string; content_hash: string }) => `${r.chunk_id}:${r.content_hash}`,
      ),
    );

    // Filter to jobs that need processing
    const toEmbed: { msg: PgmqMessage; chunk: { id: string; content: string; content_hash: string } }[] = [];

    for (const msg of messages) {
      const job = msg.message;
      const key = `${job.chunk_id}:${job.content_hash}`;

      if (processedSet.has(key)) {
        results.push({ chunk_id: job.chunk_id, status: 'skipped' });
        // Ack the message even though we skipped — it's already done
        const { error: skipAckErr } = await client.rpc('pgmq_delete', { queue_name: 'embedding_jobs', msg_id: msg.msg_id });
        if (skipAckErr) console.error(`pgmq_delete failed for msg ${msg.msg_id}: ${skipAckErr.message}`);
        continue;
      }

      const chunk = chunkMap.get(job.chunk_id);
      if (!chunk) {
        results.push({ chunk_id: job.chunk_id, status: 'failed', error: 'Chunk not found' });
        const { error: notFoundAckErr } = await client.rpc('pgmq_delete', { queue_name: 'embedding_jobs', msg_id: msg.msg_id });
        if (notFoundAckErr) console.error(`pgmq_delete failed for msg ${msg.msg_id}: ${notFoundAckErr.message}`);
        continue;
      }

      // Skip if content_hash changed since enqueue (stale message)
      if (chunk.content_hash !== job.content_hash) {
        results.push({ chunk_id: job.chunk_id, status: 'skipped' });
        const { error: staleAckErr } = await client.rpc('pgmq_delete', { queue_name: 'embedding_jobs', msg_id: msg.msg_id });
        if (staleAckErr) console.error(`pgmq_delete failed for msg ${msg.msg_id}: ${staleAckErr.message}`);
        continue;
      }

      toEmbed.push({ msg, chunk });
    }

    // Generate embeddings in batch (OpenAI supports batching)
    if (toEmbed.length > 0) {
      const texts = toEmbed.map((e) => e.chunk.content);

      let embeddings: number[][];
      try {
        embeddings = await generateEmbeddings(texts, openaiKey);
      } catch (err) {
        // If OpenAI fails, leave messages in queue for retry (visibility timeout will expire)
        const errMsg = err instanceof Error ? err.message : 'Unknown embedding error';
        for (const e of toEmbed) {
          results.push({ chunk_id: e.chunk.id, status: 'failed', error: errMsg });
        }
        return jsonResponse({ results });
      }

      // Write embeddings back and record idempotency
      for (let i = 0; i < toEmbed.length; i++) {
        const { msg, chunk } = toEmbed[i];
        const embedding = embeddings[i];

        try {
          // Update chunk with embedding
          const { error: updateError } = await client
            .from('knowledge_chunks')
            .update({
              embedding: JSON.stringify(embedding),
              embedding_version: EMBEDDING_MODEL,
              updated_at: new Date().toISOString(),
            })
            .eq('id', chunk.id);

          if (updateError) {
            results.push({ chunk_id: chunk.id, status: 'failed', error: updateError.message });
            continue;
          }

          // Record in idempotency log
          const { error: logError } = await client
            .from('embedding_job_log')
            .upsert({
              chunk_id: chunk.id,
              content_hash: chunk.content_hash,
              embedding_model: EMBEDDING_MODEL,
              processed_at: new Date().toISOString(),
            });

          if (logError) {
            // Idempotency log write failed — do NOT ack the message so it can
            // be retried; the chunk embedding is written but we have no record.
            results.push({ chunk_id: chunk.id, status: 'failed', error: `Idempotency log write failed: ${logError.message}` });
            continue;
          }

          // Ack message from queue
          const { error: deleteError } = await client.rpc('pgmq_delete', { queue_name: 'embedding_jobs', msg_id: msg.msg_id });
          if (deleteError) {
            // Non-fatal: embedding is done and logged; queue message will
            // eventually time out. Record for observability.
            console.error(`pgmq_delete failed for msg ${msg.msg_id}: ${deleteError.message}`);
          }

          results.push({ chunk_id: chunk.id, status: 'embedded' });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          results.push({ chunk_id: chunk.id, status: 'failed', error: errMsg });
        }
      }
    }

    return jsonResponse({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
