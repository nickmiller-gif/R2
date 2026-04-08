export interface EigenIngestDocument {
  title: string;
  body: string;
  content_type?: string;
  metadata?: Record<string, unknown>;
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

export function buildIdempotencyKey(sourceSystem: string, sourceRef: string): string {
  return `${sourceSystem}:${sourceRef}`;
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
  };
}
