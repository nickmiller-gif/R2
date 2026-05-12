import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import type { CharterRole } from '../_shared/roles.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { extractRequestMeta, withRequestMeta } from '../_shared/correlation.ts';
import { buildChunks, embedTexts, sha256Hex } from '../_shared/eigen.ts';
import { extractDocumentText } from '../_shared/extract-document.ts';
import {
  inferCorpusTier,
  normalizeCorpusPolicyTags,
  POLICY_TAG_RAY_VOICE,
} from '../_shared/eigen-policy.ts';
import { logError } from '../_shared/log.ts';
import {
  buildEigenKosCapabilityDenialBody,
  enforceEigenKosCapabilityBundle,
} from '../_shared/eigen-kos-enforcement.ts';
import { EIGEN_KOS_CAPABILITY } from '../../../src/lib/eigen/eigen-kos-capabilities.ts';
import {
  buildCuratorDocumentTags,
  buildCuratorSummaryLine,
  buildEmbeddingPrefixFromCuratorMetadata,
} from '../../../src/lib/eigen/eigen-curator-metadata.ts';
import { timingSafeEqual } from '../_shared/signal-utils.ts';

// Explicit `ingestion_runs` projection so schema additions don't leak through
// `select('*')` (advisor lint 0022). All three eigen-ingest call sites share
// this projection since they read / return full rows for replay semantics.
const INGESTION_RUNS_SELECT_COLUMNS =
  'chunk_count,chunking_mode,completed_at,created_at,document_id,embedding_model,id,metadata,source_ref,source_system,started_at,status';

/**
 * Validation errors for ingest payloads. The outer handler maps these to 400 so
 * health-check probes (e.g. an empty body) return 400 like `r2-signal-ingest`,
 * instead of being swallowed as 500 by the generic catch.
 */
class IngestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestValidationError';
  }
}

interface IngestDocumentPayload {
  title?: string;
  body?: string;
  content_type?: string;
  metadata?: Record<string, unknown>;
  storage_bucket?: string;
  storage_path?: string;
  file_name?: string;
}

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

interface IngestIdentity {
  userId: string;
}

const SERVICE_ROLE_OWNER_ID = '00000000-0000-0000-0000-000000000000';

/** Match CentralR2 `_shared/normalizeEigenIngestToken.ts` — trim + strip BOM / zero-width paste junk. */
function normalizeEigenIngestToken(raw: string): string {
  let s = raw.trim();
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  s = s.replace(/[\u200b-\u200d\u2060\ufeff]/g, '');
  return s.trim();
}

function resolveIngestIdentity(req: Request): IngestIdentity | null {
  const ingestTokenHeader = normalizeEigenIngestToken(
    req.headers.get('x-eigen-ingest-token') ?? '',
  );
  const configuredIngestToken = normalizeEigenIngestToken(
    Deno.env.get('EIGEN_INGEST_BACKFILL_TOKEN') ?? '',
  );
  if (
    configuredIngestToken &&
    ingestTokenHeader &&
    timingSafeEqual(ingestTokenHeader, configuredIngestToken)
  ) {
    return { userId: SERVICE_ROLE_OWNER_ID };
  }
  return null;
}

function readMaxBodyChars(): number {
  const raw = Deno.env.get('EIGEN_INGEST_MAX_BODY_CHARS') ?? '2000000';
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 5000) return 2_000_000;
  return Math.min(parsed, 10_000_000);
}

/** Cap multipart uploads and storage downloads so a single request cannot OOM the isolate. */
function readMaxBinaryBytes(): number {
  const raw = Deno.env.get('EIGEN_INGEST_MAX_BINARY_BYTES') ?? String(40 * 1024 * 1024);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 64 * 1024) return 40 * 1024 * 1024;
  return Math.min(parsed, 100 * 1024 * 1024);
}

/** Stable domain for document rows so eigen-oracle-outbox-drain can anchor signals on public ingest. */
const EIGEN_DOCUMENT_ASSET_DOMAIN = 'eigen_ingest';

async function ensureEigenDocumentAsset(
  client: SupabaseClient,
  params: { documentId: string; title: string; sourceSystem: string },
): Promise<void> {
  const label = params.title.trim().slice(0, 500) || params.sourceSystem;
  const { error } = await client.from('asset_registry').upsert(
    {
      kind: 'document',
      ref_id: params.documentId,
      domain: EIGEN_DOCUMENT_ASSET_DOMAIN,
      label,
      metadata: { source_system: params.sourceSystem },
    },
    { onConflict: 'kind,ref_id,domain' },
  );
  if (error) {
    logError('asset_registry upsert failed', {
      functionName: 'eigen-ingest',
      error: error.message,
    });
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        // fall through to comma-split parsing.
      }
    }
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (isObject(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      return isObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function toChunkingMode(value: unknown): 'hierarchical' | 'flat' {
  return value === 'flat' ? 'flat' : 'hierarchical';
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function resolveDocumentPayload(
  payload: IngestDocumentPayload,
  client: ReturnType<typeof getServiceClient>,
): Promise<{
  title: string;
  body: string;
  contentType: string;
  metadata: Record<string, unknown>;
}> {
  const metadata = isObject(payload.metadata) ? payload.metadata : {};
  if (typeof payload.body === 'string' && payload.body.trim().length > 0) {
    if (!payload.title || payload.title.trim().length === 0) {
      throw new IngestValidationError('document.title is required when document.body is provided');
    }
    return {
      title: payload.title.trim(),
      body: payload.body,
      contentType: payload.content_type ?? 'text/plain',
      metadata,
    };
  }

  const bucket = cleanString(payload.storage_bucket);
  const path = cleanString(payload.storage_path);
  if (!bucket || !path) {
    throw new IngestValidationError(
      'Either document.body or both document.storage_bucket and document.storage_path are required',
    );
  }

  const download = await client.storage.from(bucket).download(path);
  if (download.error || !download.data) {
    throw new IngestValidationError(download.error?.message ?? 'Failed to download storage object');
  }

  const bytes = new Uint8Array(await download.data.arrayBuffer());
  const maxBinary = readMaxBinaryBytes();
  if (bytes.byteLength > maxBinary) {
    throw new IngestValidationError(
      `downloaded document exceeds ${maxBinary} bytes; split the file or raise EIGEN_INGEST_MAX_BINARY_BYTES`,
    );
  }
  let extracted;
  try {
    extracted = await extractDocumentText({
      bytes,
      contentType: payload.content_type,
      fileName: payload.file_name ?? path.split('/').pop(),
      titleHint: payload.title,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Document extraction failed';
    throw new IngestValidationError(msg);
  }

  return {
    title: extracted.title,
    body: extracted.body,
    contentType: extracted.contentType,
    metadata: {
      ...metadata,
      extraction: {
        extracted_from: extracted.extractedFrom,
        byte_length: extracted.byteLength,
        truncated: extracted.truncated,
        storage_bucket: bucket,
        storage_path: path,
      },
    },
  };
}

async function parseMultipartRequest(req: Request): Promise<{
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
}> {
  const form = await req.formData();
  const sourceSystem = cleanString(form.get('source_system'));
  const sourceRef = cleanString(form.get('source_ref'));
  if (!sourceSystem) throw new IngestValidationError('source_system is required');
  if (!sourceRef) throw new IngestValidationError('source_ref is required');

  const title = cleanString(form.get('title'));
  const rawBody = form.get('body');
  const providedBody = typeof rawBody === 'string' ? rawBody : '';
  const contentType = cleanString(form.get('content_type')) ?? undefined;
  const metadata = parseMetadata(form.get('metadata'));

  let docTitle = title;
  let docBody = providedBody;
  let resolvedContentType = contentType ?? 'text/plain';
  let extractionMeta: Record<string, unknown> = {};

  const fileValue = form.get('file');
  if (fileValue instanceof File) {
    const maxBinary = readMaxBinaryBytes();
    if (fileValue.size > maxBinary) {
      throw new IngestValidationError(
        `upload exceeds ${maxBinary} bytes; split the file or raise EIGEN_INGEST_MAX_BINARY_BYTES`,
      );
    }
    const bytes = new Uint8Array(await fileValue.arrayBuffer());
    const extracted = await extractDocumentText({
      bytes,
      contentType: contentType ?? fileValue.type,
      fileName: fileValue.name,
      titleHint: title,
    });
    docTitle = extracted.title;
    docBody = extracted.body;
    resolvedContentType = extracted.contentType;
    extractionMeta = {
      extracted_from: extracted.extractedFrom,
      byte_length: extracted.byteLength,
      truncated: extracted.truncated,
      file_name: fileValue.name,
    };
  }

  if (!docTitle || docTitle.trim().length === 0) {
    throw new IngestValidationError('title is required');
  }
  if (!docBody || docBody.trim().length === 0) {
    throw new IngestValidationError('document body is required');
  }

  return {
    source_system: sourceSystem,
    source_ref: sourceRef,
    document: {
      title: docTitle,
      body: docBody,
      content_type: resolvedContentType,
      metadata:
        Object.keys(extractionMeta).length > 0
          ? { ...metadata, extraction: extractionMeta }
          : metadata,
    },
    chunking_mode: toChunkingMode(form.get('chunking_mode')),
    policy_tags: normalizeStringList(form.get('policy_tags')),
    entity_ids: normalizeStringList(form.get('entity_ids')),
    embedding_model: cleanString(form.get('embedding_model')),
  };
}

async function parseJsonRequest(
  req: Request,
  client: ReturnType<typeof getServiceClient>,
): Promise<IngestRequestBody> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new IngestValidationError('Request body must be a JSON object');
  }
  if (!isObject(body)) {
    throw new IngestValidationError('Request body must be a JSON object');
  }

  const sourceSystem = cleanString(body.source_system);
  const sourceRef = cleanString(body.source_ref);
  if (!sourceSystem) throw new IngestValidationError('source_system is required');
  if (!sourceRef) throw new IngestValidationError('source_ref is required');
  if (!isObject(body.document)) throw new IngestValidationError('document object is required');

  const documentInput: IngestDocumentPayload = {
    title: cleanString(body.document.title),
    body: typeof body.document.body === 'string' ? body.document.body : undefined,
    content_type: cleanString(body.document.content_type),
    metadata: parseMetadata(body.document.metadata),
    storage_bucket: cleanString(body.document.storage_bucket),
    storage_path: cleanString(body.document.storage_path),
    file_name: cleanString(body.document.file_name),
  };

  const resolvedDocument = await resolveDocumentPayload(documentInput, client);
  return {
    source_system: sourceSystem,
    source_ref: sourceRef,
    document: {
      title: resolvedDocument.title,
      body: resolvedDocument.body,
      content_type: resolvedDocument.contentType,
      metadata: resolvedDocument.metadata,
    },
    chunking_mode: toChunkingMode(body.chunking_mode),
    policy_tags: normalizeStringList(body.policy_tags),
    entity_ids: normalizeStringList(body.entity_ids),
    embedding_model: cleanString(body.embedding_model),
  };
}

async function parseRequest(
  req: Request,
  client: ReturnType<typeof getServiceClient>,
): Promise<IngestRequestBody> {
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    return parseMultipartRequest(req);
  }
  return parseJsonRequest(req, client);
}

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const serviceIdentity = resolveIngestIdentity(req);
    let ownerUserId: string;
    // Captured for later KOS bundle enforcement — empty when the service
    // ingest token was used (that path is trusted and bypasses RLS / roles
    // by design).
    let kosCallerRoles: CharterRole[] = [];
    if (serviceIdentity) {
      ownerUserId = serviceIdentity.userId;
    } else {
      const auth = await guardAuth(req);
      if (!auth.ok) return auth.response;
      const roleCheck = await requireRole(auth.claims.userId, 'member');
      if (!roleCheck.ok) return roleCheck.response;
      ownerUserId = auth.claims.userId;
      kosCallerRoles = roleCheck.roles;
    }

    const idemError = requireIdempotencyKey(req);
    if (idemError) return idemError;

    try {
      const requestMeta = extractRequestMeta(req);
      const client = getServiceClient();
      const requestBody = await parseRequest(req, client);
      const maxBodyChars = readMaxBodyChars();
      if (requestBody.document.body.length > maxBodyChars) {
        return errorResponse(
          `document.body exceeds ${maxBodyChars} chars; split into multiple documents or increase EIGEN_INGEST_MAX_BODY_CHARS`,
          400,
        );
      }
      const sourceSystemLower = requestBody.source_system.toLowerCase();
      const policyTags = normalizeCorpusPolicyTags(requestBody.policy_tags ?? []);
      if (
        sourceSystemLower.includes('upload') ||
        sourceSystemLower.includes('manual') ||
        sourceSystemLower.includes('autonomous')
      ) {
        if (!policyTags.includes('user_upload')) {
          policyTags.push('user_upload');
        }
      }
      if (sourceSystemLower.includes('ray_voice') || sourceSystemLower.includes('ray-podcast')) {
        if (!policyTags.includes(POLICY_TAG_RAY_VOICE)) {
          policyTags.push(POLICY_TAG_RAY_VOICE);
        }
        // Keep voice docs highly trusted for style guidance, while topic selection
        // is still constrained by retrieval relevance controls.
        if (!policyTags.includes('voice_style')) {
          policyTags.push('voice_style');
        }
      }

      // Enforce the ingest KOS capability bundle (write:document / write:knowledge
      // / write:embedding) for the policy tags this request wants to write to.
      // The service ingest token path (`x-eigen-ingest-token`) bypasses this —
      // that channel is trusted and authenticated at the token layer. The seed
      // rules currently require `operator` for every `write:*` pattern on both
      // `eigenx` and `eigen_public` scopes, which matches the existing
      // `requireRole('member')` gate's intent once it's lifted to operator.
      if (!serviceIdentity) {
        const kos = await enforceEigenKosCapabilityBundle(client, {
          policyTags,
          requiredCapabilityTags: EIGEN_KOS_CAPABILITY.ingest,
          callerRoles: kosCallerRoles,
          surface: 'eigen-ingest',
        });
        if (!kos.ok) {
          return new Response(JSON.stringify(buildEigenKosCapabilityDenialBody(kos.denial)), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const effectiveEmbeddingModel =
        typeof requestBody.embedding_model === 'string' &&
        requestBody.embedding_model.trim().length > 0
          ? requestBody.embedding_model.trim()
          : 'text-embedding-3-small';

      const entityKey = [...(requestBody.entity_ids ?? [])].sort().join('\u0002');
      const policyKey = [...policyTags].sort().join('\u0002');
      const docMeta = (requestBody.document.metadata ?? {}) as Record<string, unknown>;
      const curatorDocumentTags = buildCuratorDocumentTags(docMeta);
      const curatorKey = [...curatorDocumentTags].sort().join('\u0002');
      const documentHash = await sha256Hex(
        `${requestBody.document.title}\u001f${requestBody.document.body}\u001f${requestBody.chunking_mode}\u001f${effectiveEmbeddingModel}\u001f${entityKey}\u001f${policyKey}\u001f${curatorKey}`,
      );

      const [existingRunResult, existingDocResult] = await Promise.all([
        client
          .from('ingestion_runs')
          .select(INGESTION_RUNS_SELECT_COLUMNS)
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
              .select(INGESTION_RUNS_SELECT_COLUMNS)
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
          await ensureEigenDocumentAsset(client, {
            documentId: existingDoc.id as string,
            title: requestBody.document.title,
            sourceSystem: requestBody.source_system,
          });
          return jsonResponse({
            document_id: existingDoc.id,
            ingestion_run_id: ingestionRunId,
            chunks_created: chunkCount,
            embedding_dimensions: 1536,
            oracle_outbox_event_id:
              (runMeta?.oracle_outbox_event_id as string | null | undefined) ?? null,
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
          .select(INGESTION_RUNS_SELECT_COLUMNS)
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

      const upsertPayload: Record<string, unknown> = {
        source_system: requestBody.source_system,
        source_ref: requestBody.source_ref,
        owner_id: ownerUserId,
        title: requestBody.document.title,
        body: requestBody.document.body,
        content_type: requestBody.document.content_type,
        content_hash: documentHash,
        index_status: 'indexed',
        embedding_status: 'embedded',
        extracted_text_status: 'extracted',
        updated_at: new Date().toISOString(),
      };
      if (curatorDocumentTags.length > 0) {
        upsertPayload.tags = curatorDocumentTags;
        const summaryLine = buildCuratorSummaryLine(docMeta);
        if (summaryLine) upsertPayload.summary = summaryLine;
      }

      const upsertDoc = await client
        .from('documents')
        .upsert(upsertPayload, { onConflict: 'source_system,source_ref' })
        .select('id')
        .single();

      if (upsertDoc.error) return errorResponse(upsertDoc.error.message, 400);
      const documentId = upsertDoc.data.id as string;

      await ensureEigenDocumentAsset(client, {
        documentId,
        title: requestBody.document.title,
        sourceSystem: requestBody.source_system,
      });

      const deleteChunks = await client
        .from('knowledge_chunks')
        .delete()
        .eq('document_id', documentId);
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

      const embeddingPrefix = buildEmbeddingPrefixFromCuratorMetadata(docMeta);
      const { embeddings, model: resolvedEmbeddingModel } = await embedTexts(
        chunks.map((chunk) => {
          const shouldPrefix =
            embeddingPrefix.length > 0 &&
            (chunk.chunkLevel === 'document' || chunk.chunkLevel === 'section');
          return shouldPrefix ? `${embeddingPrefix}${chunk.content}` : chunk.content;
        }),
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
          policy_tags: policyTags,
          authority_score:
            sourceSystemLower.includes('upload') || sourceSystemLower.includes('manual')
              ? 92
              : chunk.chunkLevel === 'claim'
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
                  tags: policyTags,
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
            corpus_tier: inferCorpusTier(policyTags),
            curator_document_tags: curatorDocumentTags,
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
          curator_document_tags: curatorDocumentTags,
        },
        201,
      );
    } catch (err) {
      // Map declared validation errors to 400 so health-check probes with a
      // minimal body get a 400 (matching `r2-signal-ingest`) instead of 500.
      if (err instanceof IngestValidationError) {
        return errorResponse(err.message, 400);
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      return errorResponse(message, 500);
    }
  }),
);
