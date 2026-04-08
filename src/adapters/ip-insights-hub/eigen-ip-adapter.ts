import {
  createEigenIngestClient,
  type EigenIngestClientConfig,
  type EigenIngestRequest,
} from '../eigen-ingest-client.js';

export interface IpAnalysisCompletedEvent {
  analysis_run_id: string;
  analysis_title: string;
  full_analysis_text: string;
  entity_ids?: string[];
  generated_at?: string;
}

export interface IpAdapterConfig extends EigenIngestClientConfig {
  defaultPolicyTags?: string[];
}

export function mapIpEventToEigenDocument(event: IpAnalysisCompletedEvent): EigenIngestRequest {
  return {
    source_system: 'ip-insights-hub',
    source_ref: event.analysis_run_id,
    document: {
      title: event.analysis_title,
      body: event.full_analysis_text,
      content_type: 'analysis_report',
      metadata: {
        domain: 'ip',
        sub_type: 'landscape',
        generated_at: event.generated_at ?? null,
      },
    },
    chunking_mode: 'hierarchical',
    policy_tags: ['ip-confidential', 'ip-analysis', 'ip-landscape'],
    entity_ids: event.entity_ids ?? [],
  };
}

export function createIpInsightsHubEigenAdapter(config: IpAdapterConfig) {
  const ingestClient = createEigenIngestClient(config);

  return {
    async onAnalysisCompleted(event: IpAnalysisCompletedEvent) {
      const payload = mapIpEventToEigenDocument(event);
      if (config.defaultPolicyTags && config.defaultPolicyTags.length > 0) {
        payload.policy_tags = Array.from(new Set([...(payload.policy_tags ?? []), ...config.defaultPolicyTags]));
      }
      return ingestClient.ingest(payload);
    },
  };
}
