import {
  createEigenIngestClient,
  type EigenIngestClientConfig,
  type EigenIngestRequest,
} from '../eigen-ingest-client.js';
import { visibilityPolicyTags, type AdapterVisibility } from '../shared/adapter-metadata.js';

/** Emitted when a validation batch completes (INSR → Eigen document ingest). */
export interface InsrValidationCompleteEvent {
  batch_id: string;
  submission_id: string;
  summary: string;
  body: string;
  visibility?: AdapterVisibility;
  completed_at?: string;
  entity_ids?: string[];
}

export function mapInsrValidationCompleteToEigen(
  event: InsrValidationCompleteEvent,
): EigenIngestRequest {
  const visibility = event.visibility ?? 'operator';
  return {
    source_system: 'insr',
    source_ref: `validation_batch:${event.batch_id}`,
    document: {
      title: event.summary.slice(0, 512),
      body: event.body,
      content_type: 'insr_validation_summary',
      metadata: {
        source_system: 'insr',
        batch_id: event.batch_id,
        submission_id: event.submission_id,
        completed_at: event.completed_at ?? null,
        visibility,
      },
    },
    chunking_mode: 'hierarchical',
    policy_tags: visibilityPolicyTags(visibility, ['insr', 'validation-complete']),
    entity_ids: event.entity_ids ?? [],
  };
}

export function createInsrEigenAdapter(config: EigenIngestClientConfig) {
  const ingestClient = createEigenIngestClient(config);
  return {
    async onValidationComplete(event: InsrValidationCompleteEvent) {
      return ingestClient.ingest(mapInsrValidationCompleteToEigen(event));
    },
  };
}
