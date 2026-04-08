import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { extractRequestMeta } from '../_shared/correlation.ts';
import { buildChunks, embedTexts, sha256Hex } from '../_shared/eigen.ts';

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

    const effectiveEmbeddingModel =
      typeof requestBody.embedding_model === 'string' && requestBody.embedding_model.trim().length > 0
        ? requestBody.embedding_model.trim()
        : 'text-embedding-3-small';

    const entityKey = [...requestBody.entity_ids].sort().join('\u0002');
    const policyKey = [...requestBody.policy_tags].sort().join('\u0002');
    const documentHash = await sha256Hex(
      `${requestBody.document.title}\u001f${requestBody.document.body}\u001f${requestBody.chunking_mode}\u001f${effectiveEmbeddingModel}\u001f${entityKey}\u001f${policyKey}`,
    );

    const [existingRunResult, existingDocResult] = await Promise.all([
      client
        .from('ingestion_runs')
        .select('*')
        .eq('source_system', requestBody.source_system)
        .eq('source_ref', requestBody.source_ref)
        .limit(1)
        .maybeSingle(),
      client
        .from('documents')
        .select('id, content_hash')
        .eq('source_system', requestBody.source_system)
        .eq('source_ref', requestBody.source_ref)
        .maybeSingle(),
    ]);

    if (existingRunResult.error) {
      return errorResponse(existingRunResult.error.message, 400);
    }
    if (existingDocResult.error) {
      return errorResponse(existingDocResult.error.message, 400);
    }

    const existingDoc = existingDocResult.data;
    if (existingDoc && existingDoc.content_hash === documentHash) {
      const chunkHead = await client
        .from('knowledge_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', existingDoc.id);

      if (chunkHead.error) {
        return errorResponse(chunkHead.error.message, 400);
      }

      const chunkCount = chunkHead.count ?? 0;
      if (chunkCount > 0) {
        let ingestionRunId = existingRunResult.data?.id as string | undefined;
        const nowIso = new Date().toISOString();

        if (!ingestionRunId) {
          const runInsert = await client
            .from('ingestion_runs')
            .insert([
              {
                source_system: requestBody.source_system,
                source_ref: requestBody.source_ref,
                chunking_mode: requestBody.chunking_mode,
                embedding_model: effectiveEmbeddingModel,
                status: 'completed',
                document_id: existingDoc.id,
                chunk_count: chunkCount,
                completed_at: nowIso,
                metadata: { content_unchanged_fast_path: true },
              },
            ])
            .select('*')
            .single();

          if (runInsert.error) return errorResponse(runInsert.error.message, 400);
          ingestionRunId = runInsert.data.id;
        } else {
          const prev = existingRunResult.data?.metadata;
          const prevMeta =
            prev && typeof prev === 'object' && prev !== null && !Array.isArray(prev)
              ? (prev as Record<string, unknown>)
              : {};
          const runUpdate = await client
            .from('ingestion_runs')
            .update({
              status: 'completed',
              document_id: existingDoc.id,
              chunk_count: chunkCount,
              completed_at: nowIso,
              embedding_model: effectiveEmbeddingModel,
              metadata: {
                ...prevMeta,
                content_unchanged_fast_path: true,
              },
            })
            .eq('id', ingestionRunId);

          if (runUpdate.error) return errorResponse(runUpdate.error.message, 400);
        }

        const runMeta = existingRunResult.data?.metadata as Record<string, unknown> | undefined;
        return jsonResponse({
          document_id: existingDoc.id,
          ingestion_run_id: ingestionRunId,
          chunks_created: chunkCount,
          embedding_dimensions: 1536,
          oracle_outbox_event_id: (runMeta?.oracle_outbox_event_id as string | null | undefined) ?? null,
          content_unchanged: true,
          idempotent_replay: true,
        });
      }
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
            embedding_model: effectiveEmbeddingModel,
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

    const upsertDoc = await client
      .from('documents')
      .upsert(
        {
          source_system: requestBody.source_system,
          source_ref: requestBody.source_ref,
          owner_id: auth.claims.userId,
          title: requestBody.document.title,
          body: requestBody.document.body,
          content_type: requestBody.document.content_type,
          content_hash: documentHash,
          index_status: 'indexed',
          embedding_status: 'embedded',
          extracted_text_status: 'extracted',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'source_system,source_ref' },
      )
      .select('id')
      .single();

    if (upsertDoc.error) return errorResponse(upsertDoc.error.message, 400);
    const documentId = upsertDoc.data.id as string;

    const deleteChunks = await client.from('knowledge_chunks').delete().eq('document_id', documentId);
    if (deleteChunks.error) return errorResponse(deleteChunks.error.message, 400);

    const linkDocToRun = await client
      .from('ingestion_runs')
      .update({ document_id: documentId })
      .eq('id', ingestionRunId);
    if (linkDocToRun.error) return errorResponse(linkDocToRun.error.message, 400);

    const chunks = buildChunks(
      requestBody.document.title,
      requestBody.document.body,
      requestBody.chunking_mode ?? 'hierarchical',
    );

    const { embeddings, model: resolvedEmbeddingModel } = await embedTexts(
      chunks.map((chunk) => chunk.content),
      effectiveEmbeddingModel,
    );

    const chunkContentHashes = await Promise.all(
      chunks.map((chunk) => sha256Hex(`${documentId}:${chunk.chunkLevel}:${chunk.content}`)),
    );

    const chunkRows: Record<string, unknown>[] = [];
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index]!;
      const embedding = embeddings[index];
      if (!embedding) {
        return errorResponse(`Missing embedding for chunk index ${index}`, 500);
      }
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
        content_hash: chunkContentHashes[index],
        embedding_version: resolvedEmbeddingModel,
        ingestion_run_id: ingestionRunId,
        embedding,
      });
    }

    const CHUNK_INSERT_BATCH = 150;
    for (let offset = 0; offset < chunkRows.length; offset += CHUNK_INSERT_BATCH) {
      const slice = chunkRows.slice(offset, offset + CHUNK_INSERT_BATCH);
      const chunkInsert = await client.from('knowledge_chunks').insert(slice);
      if (chunkInsert.error) return errorResponse(chunkInsert.error.message, 400);
    }

    let oracleOutboxEventId: string | null = null;
    const outboxEnabled = (Deno.env.get('EIGEN_ORACLE_OUTBOX_ENABLED') ?? 'false') === 'true';
    if (outboxEnabled && requestMeta.idempotencyKey) {
      const existingOutbox = await client
        .from('eigen_oracle_outbox')
        .select('id')
        .eq('idempotency_key', requestMeta.idempotencyKey)
        .maybeSingle();

      if (existingOutbox.error) return errorResponse(existingOutbox.error.message, 400);
      if (existingOutbox.data?.id) {
        oracleOutboxEventId = existingOutbox.data.id as string;
      } else {
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
    }

    const runComplete = await client
      .from('ingestion_runs')
      .update({
        status: 'completed',
        document_id: documentId,
        chunk_count: chunkRows.length,
        embedding_model: resolvedEmbeddingModel,
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
