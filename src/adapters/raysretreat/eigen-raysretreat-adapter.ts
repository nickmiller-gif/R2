import {
  createEigenIngestClient,
  type EigenIngestClientConfig,
  type EigenIngestRequest,
} from '../eigen-ingest-client.js';
import { visibilityPolicyTags, type AdapterVisibility } from '../shared/adapter-metadata.js';

export interface RaysRetreatContentEvent {
  record_id: string;
  title: string;
  body: string;
  site_id?: string;
  visibility?: AdapterVisibility;
  content_type?: string;
  tags?: string[];
  entity_ids?: string[];
  updated_at?: string;
}

export function mapRaysRetreatEventToEigen(event: RaysRetreatContentEvent): EigenIngestRequest {
  const visibility = event.visibility ?? 'public';
  return {
    source_system: 'raysretreat',
    source_ref: event.record_id,
    document: {
      title: event.title,
      body: event.body,
      content_type: event.content_type ?? 'text/plain',
      metadata: {
        site_id: event.site_id ?? 'raysretreat',
        source_system: 'raysretreat',
        source_ref: event.record_id,
        visibility,
        updated_at: event.updated_at ?? null,
      },
    },
    chunking_mode: 'hierarchical',
    policy_tags: visibilityPolicyTags(visibility, event.tags ?? []),
    entity_ids: event.entity_ids ?? [],
  };
}

export function createRaysRetreatEigenAdapter(config: EigenIngestClientConfig) {
  const ingestClient = createEigenIngestClient(config);
  return {
    async onContentUpdated(event: RaysRetreatContentEvent) {
      return ingestClient.ingest(mapRaysRetreatEventToEigen(event));
    },
  };
}
