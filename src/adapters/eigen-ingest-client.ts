export interface EigenIngestDocument {
  title?: string;
  body?: string;
  content_type?: string;
  metadata?: Record<string, unknown>;
  storage_bucket?: string;
  storage_path?: string;
  file_name?: string;
}

export interface EigenIngestRequest {
  source_system: string;
  source_ref: string;
  document: EigenIngestDocument;
  chunking_mode?: 'hierarchical' | 'flat';
  policy_tags?: string[];
  entity_ids?: string[];
  embedding_model?: string;
}

export interface EigenIngestResponse {
  document_id: string;
  ingestion_run_id: string;
  chunks_created: number;
  embedding_dimensions: number;
  oracle_outbox_event_id: string | null;
}

export interface EigenIngestClientConfig {
  endpoint: string;
  getAccessToken: () => Promise<string>;
}

export interface EigenMultipartIngestInput {
  source_system: string;
  source_ref: string;
  file: File | Blob;
  file_name?: string;
  title?: string;
  content_type?: string;
  metadata?: Record<string, unknown>;
  chunking_mode?: 'hierarchical' | 'flat';
  policy_tags?: string[];
  entity_ids?: string[];
  embedding_model?: string;
}

export function buildIdempotencyKey(sourceSystem: string, sourceRef: string): string {
  return `${encodeURIComponent(sourceSystem)}:${encodeURIComponent(sourceRef)}`;
}

export function createEigenIngestClient(config: EigenIngestClientConfig) {
  return {
    async ingest(payload: EigenIngestRequest): Promise<EigenIngestResponse> {
      const token = await config.getAccessToken();
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-idempotency-key': buildIdempotencyKey(payload.source_system, payload.source_ref),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Eigen ingest failed (${response.status}): ${errorText}`);
      }

      return (await response.json()) as EigenIngestResponse;
    },
    async ingestMultipart(input: EigenMultipartIngestInput): Promise<EigenIngestResponse> {
      const token = await config.getAccessToken();
      const form = new FormData();
      form.set('source_system', input.source_system);
      form.set('source_ref', input.source_ref);
      form.set('chunking_mode', input.chunking_mode ?? 'hierarchical');
      if (input.title) form.set('title', input.title);
      if (input.content_type) form.set('content_type', input.content_type);
      if (input.embedding_model) form.set('embedding_model', input.embedding_model);
      if (input.metadata) form.set('metadata', JSON.stringify(input.metadata));
      if (input.policy_tags && input.policy_tags.length > 0) {
        form.set('policy_tags', JSON.stringify(input.policy_tags));
      }
      if (input.entity_ids && input.entity_ids.length > 0) {
        form.set('entity_ids', JSON.stringify(input.entity_ids));
      }

      const fileName = input.file_name ?? (input.file instanceof File ? input.file.name : 'upload.bin');
      form.set('file', input.file, fileName);

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-idempotency-key': buildIdempotencyKey(input.source_system, input.source_ref),
        },
        body: form,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Eigen ingest failed (${response.status}): ${errorText}`);
      }

      return (await response.json()) as EigenIngestResponse;
    },
  };
}
