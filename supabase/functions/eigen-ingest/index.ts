import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { extractRequestMeta } from '../_shared/correlation.ts';
import { buildChunks, embedText, sha256Hex } from '../_shared/eigen.ts';

interface IngestRequestBody {
  source_system: string;
  source_ref: string;
  document: {
    title: string;
    body: string;
    content_type?: string;
    metadata?: Record<string, unknown>;
  };
  chunking_mode?: 'hierarchical' | 'flat';
  policy_tags?: string[];
  entity_ids?: string[];
  embedding_model?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateRequest(body: unknown): IngestRequestBody {
  if (!isObject(body)) {
    throw new Error('Request body must be a JSON object');
  }

  if (typeof body.source_system !== 'string' || body.source_system.trim().length === 0) {
    throw new Error('source_system is required');
  }
  if (typeof body.source_ref !== 'string' || body.source_ref.trim().length === 0) {
    throw new Error('source_ref is required');
  }
  if (!isObject(body.document)) {
    throw new Error('document object is required');
  }
  if (typeof body.document.title !== 'string' || body.document.title.trim().length === 0) {
    throw new Error('document.title is required');
  }
  if (typeof body.document.body !== 'string' || body.document.body.trim().length === 0) {
    throw new Error('document.body is required');
  }

  return {
    source_system: body.source_system.trim(),
    source_ref: body.source_ref.trim(),
    document: {
      title: body.document.title.trim(),
      body: body.document.body,
      content_type:
        typeof body.document.content_type === 'string'
          ? body.document.content_type
          : 'text/plain',
      metadata: isObject(body.document.metadata) ? body.document.metadata : {},
    },
    chunking_mode: body.chunking_mode === 'flat' ? 'flat' : 'hierarchical',
    policy_tags: Array.isArray(body.policy_tags) ? body.policy_tags.map(String) : [],
    entity_ids: Array.isArray(body.entity_ids) ? body.entity_ids.map(String) : [],
    embedding_model:
      typeof body.embedding_model === 'string' && body.embedding_model.trim().length > 0
        ? body.embedding_model.trim()
        : undefined,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  const roleCheck = await requireRole(auth.claims.userId, 'member');
  if (!roleCheck.ok) return roleCheck.response;

  const idemError = requireIdempotencyKey(req);
  if (idemError) return idemError;

  try {
    const requestBody = validateRequest(await req.json());
    const requestMeta = extractRequestMeta(req);
    const client = getServiceClient();

    const existingRunResult = await client
      .from('ingestion_runs')
      .select('*')
      .eq('source_system', requestBody.source_system)
      .eq('source_ref', requestBody.source_ref)
      .limit(1)
      .maybeSingle();

    if (existingRunResult.error) {
      return errorResponse(existingRunResult.error.message, 400);
    }

    if (existingRunResult.data && existingRunResult.data.status === 'completed') {
      return jsonResponse({
        document_id: existingRunResult.data.document_id,
        ingestion_run_id: existingRunResult.data.id,
        chunks_created: existingRunResult.data.chunk_count ?? 0,
        embedding_dimensions: 1536,
        oracle_outbox_event_id: existingRunResult.data.metadata?.oracle_outbox_event_id ?? null,
        idempotent_replay: true,
      });
    }

    let ingestionRunId = existingRunResult.data?.id as string | undefined;
    if (!ingestionRunId) {
      const runInsert = await client
        .from('ingestion_runs')
        .insert([
          {
            source_system: requestBody.source_system,
            source_ref: requestBody.source_ref,
            chunking_mode: requestBody.chunking_mode,
            embedding_model: requestBody.embedding_model ?? 'text-embedding-3-small',
            status: 'running',
          },
        ])
        .select('*')
        .single();

      if (runInsert.error) return errorResponse(runInsert.error.message, 400);
      ingestionRunId = runInsert.data.id;
    } else {
      const runUpdate = await client
        .from('ingestion_runs')
        .update({
          status: 'running',
          completed_at: null,
          metadata: {
            resumed_from_existing: true,
          },
        })
        .eq('id', ingestionRunId);
      if (runUpdate.error) return errorResponse(runUpdate.error.message, 400);
    }

    const documentHash = await sha256Hex(
      `${requestBody.source_system}:${requestBody.source_ref}:${requestBody.document.body}`,
    );

    const documentInsert = await client
      .from('documents')
      .insert([
        {
          source_system: requestBody.source_system,
          owner_id: auth.claims.userId,
          title: requestBody.document.title,
          body: requestBody.document.body,
          content_type: requestBody.document.content_type,
          content_hash: documentHash,
          index_status: 'indexed',
          embedding_status: 'embedded',
          extracted_text_status: 'extracted',
        },
      ])
      .select('id')
      .single();
    if (documentInsert.error) return errorResponse(documentInsert.error.message, 400);

    const documentId = documentInsert.data.id as string;
    const chunks = buildChunks(
      requestBody.document.title,
      requestBody.document.body,
      requestBody.chunking_mode ?? 'hierarchical',
    );

    const chunkRows: Record<string, unknown>[] = [];
    let effectiveEmbeddingModel = requestBody.embedding_model ?? 'text-embedding-3-small';
    for (const chunk of chunks) {
      const { embedding, model } = await embedText(chunk.content, requestBody.embedding_model);
      effectiveEmbeddingModel = model;
      chunkRows.push({
        document_id: documentId,
        chunk_level: chunk.chunkLevel,
        heading_path: chunk.headingPath,
        entity_ids: requestBody.entity_ids ?? [],
        policy_tags: requestBody.policy_tags ?? [],
        authority_score:
          chunk.chunkLevel === 'claim'
            ? 85
            : chunk.chunkLevel === 'paragraph'
            ? 70
            : chunk.chunkLevel === 'section'
            ? 60
            : 55,
        freshness_score: 100,
        provenance_completeness: 100,
        content: chunk.content,
        content_hash: await sha256Hex(`${documentId}:${chunk.chunkLevel}:${chunk.content}`),
        embedding_version: effectiveEmbeddingModel,
        ingestion_run_id: ingestionRunId,
        embedding,
      });
    }

    if (chunkRows.length > 0) {
      const chunkInsert = await client.from('knowledge_chunks').insert(chunkRows);
      if (chunkInsert.error) return errorResponse(chunkInsert.error.message, 400);
    }

    let oracleOutboxEventId: string | null = null;
    const outboxEnabled = (Deno.env.get('EIGEN_ORACLE_OUTBOX_ENABLED') ?? 'false') === 'true';
    if (outboxEnabled) {
      const outboxInsert = await client
        .from('eigen_oracle_outbox')
        .insert([
          {
            event_type: 'signal_candidate',
            payload: {
              source_document_id: documentId,
              source_system: requestBody.source_system,
              source_ref: requestBody.source_ref,
              signal_type: 'knowledge_ingest',
              suggested_score: null,
              confidence_band: null,
              reason_traces: chunks.slice(0, 8).map((chunk) => chunk.headingPath.join(' > ')),
              entity_ids: requestBody.entity_ids ?? [],
              tags: requestBody.policy_tags ?? [],
              analysis_document_id: null,
            },
            source_document_id: documentId,
            source_system: requestBody.source_system,
            source_ref: requestBody.source_ref,
            correlation_id: requestMeta.correlationId,
            idempotency_key: requestMeta.idempotencyKey,
            status: 'pending',
          },
        ])
        .select('id')
        .single();

      if (outboxInsert.error) return errorResponse(outboxInsert.error.message, 400);
      oracleOutboxEventId = outboxInsert.data.id as string;
    }

    const runComplete = await client
      .from('ingestion_runs')
      .update({
        status: 'completed',
        document_id: documentId,
        chunk_count: chunkRows.length,
        embedding_model: effectiveEmbeddingModel,
        completed_at: new Date().toISOString(),
        metadata: {
          oracle_outbox_event_id: oracleOutboxEventId,
          request_metadata: requestBody.document.metadata ?? {},
        },
      })
      .eq('id', ingestionRunId);
    if (runComplete.error) return errorResponse(runComplete.error.message, 400);

    return jsonResponse(
      {
        document_id: documentId,
        ingestion_run_id: ingestionRunId,
        chunks_created: chunkRows.length,
        embedding_dimensions: 1536,
        oracle_outbox_event_id: oracleOutboxEventId,
      },
      201,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
