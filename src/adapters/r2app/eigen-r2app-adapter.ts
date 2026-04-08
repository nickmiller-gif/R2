import {
  createEigenIngestClient,
  type EigenIngestClientConfig,
  type EigenIngestRequest,
} from '../eigen-ingest-client.js';
import { visibilityPolicyTags, type AdapterVisibility } from '../shared/adapter-metadata.js';

export interface R2AppConversationEvent {
  event_id: string;
  title: string;
  transcript: string;
  site_id?: string;
  visibility?: AdapterVisibility;
  policy_tags?: string[];
  entity_ids?: string[];
  captured_at?: string;
}

export function mapR2AppEventToEigen(event: R2AppConversationEvent): EigenIngestRequest {
  const visibility = event.visibility ?? 'public';
  return {
    source_system: 'r2app',
    source_ref: event.event_id,
    document: {
      title: event.title,
      body: event.transcript,
      content_type: 'conversation_transcript',
      metadata: {
        site_id: event.site_id ?? 'r2app',
        source_system: 'r2app',
        source_ref: event.event_id,
        visibility,
        captured_at: event.captured_at ?? null,
      },
    },
    chunking_mode: 'hierarchical',
    policy_tags: visibilityPolicyTags(visibility, event.policy_tags ?? ['engagement']),
    entity_ids: event.entity_ids ?? [],
  };
}

export function createR2AppEigenAdapter(config: EigenIngestClientConfig) {
  const ingestClient = createEigenIngestClient(config);
  return {
    async onConversationCaptured(event: R2AppConversationEvent) {
      return ingestClient.ingest(mapR2AppEventToEigen(event));
    },
  };
}
