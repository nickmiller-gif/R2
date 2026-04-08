import {
  createEigenIngestClient,
  type EigenIngestClientConfig,
  type EigenIngestRequest,
} from '../eigen-ingest-client.js';
import { visibilityPolicyTags } from '../shared/adapter-metadata.js';

export interface CentralR2KnowledgeEvent {
  asset_id: string;
  title: string;
  narrative: string;
  site_id?: string;
  policy_tags?: string[];
  entity_ids?: string[];
  generated_at?: string;
}

export function mapCentralR2EventToEigen(event: CentralR2KnowledgeEvent): EigenIngestRequest {
  return {
    source_system: 'centralr2-core',
    source_ref: event.asset_id,
    document: {
      title: event.title,
      body: event.narrative,
      content_type: 'asset_narrative',
      metadata: {
        site_id: event.site_id ?? 'centralr2-core',
        source_system: 'centralr2-core',
        source_ref: event.asset_id,
        visibility: 'eigenx',
        generated_at: event.generated_at ?? null,
      },
    },
    chunking_mode: 'hierarchical',
    policy_tags: visibilityPolicyTags('eigenx', event.policy_tags ?? ['asset-intel']),
    entity_ids: event.entity_ids ?? [],
  };
}

export function createCentralR2EigenAdapter(config: EigenIngestClientConfig) {
  const ingestClient = createEigenIngestClient(config);
  return {
    async onKnowledgeUpdated(event: CentralR2KnowledgeEvent) {
      return ingestClient.ingest(mapCentralR2EventToEigen(event));
    },
  };
}
