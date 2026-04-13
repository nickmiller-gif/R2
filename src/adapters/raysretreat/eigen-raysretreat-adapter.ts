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

export interface ThoughtPieceEvent {
  id: string;
  retreat_year_id: string;
  title: string;
  content: string;
  theme_tags: string[];
  generated_at: string;
  content_hash: string;
  visibility?: AdapterVisibility;
}

export function mapThoughtPieceToEigen(event: ThoughtPieceEvent): EigenIngestRequest {
  const visibility = event.visibility ?? 'public';
  const extraTags = ['raysretreat', 'retreat-thought-piece', ...event.theme_tags.filter(Boolean)];
  return {
    source_system: 'raysretreat',
    source_ref: `agenda_thought_pieces:${event.id}`,
    document: {
      title: event.title,
      body: event.content,
      content_type: 'retreat_thought_piece',
      metadata: {
        table: 'agenda_thought_pieces',
        retreat_year_id: event.retreat_year_id,
        generated_at: event.generated_at,
        content_hash: event.content_hash,
        theme_tags: event.theme_tags,
        visibility,
      },
    },
    chunking_mode: 'hierarchical',
    policy_tags: visibilityPolicyTags(visibility, extraTags),
    entity_ids: [],
  };
}

export function createRaysRetreatEigenAdapter(config: EigenIngestClientConfig) {
  const ingestClient = createEigenIngestClient(config);
  return {
    async onContentUpdated(event: RaysRetreatContentEvent) {
      return ingestClient.ingest(mapRaysRetreatEventToEigen(event));
    },
    async onThoughtPieceUpdated(event: ThoughtPieceEvent) {
      return ingestClient.ingest(mapThoughtPieceToEigen(event));
    },
  };
}
