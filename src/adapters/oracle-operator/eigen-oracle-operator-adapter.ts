import {
  createEigenIngestClient,
  type EigenIngestClientConfig,
  type EigenIngestRequest,
} from '../eigen-ingest-client.js';

/** Minimal operator decision/outcome payload for EigenX grounding ingest. */
export interface OracleOperatorGroundingEvent {
  decision_id: string;
  title: string;
  body: string;
  entity_ids?: string[];
  /** ISO-8601 timestamp of the operator action. */
  decided_at?: string;
}

export interface OracleOperatorAdapterConfig extends EigenIngestClientConfig {
  defaultPolicyTags?: string[];
}

export function mapOracleOperatorEventToEigenDocument(
  event: OracleOperatorGroundingEvent,
): EigenIngestRequest {
  return {
    source_system: 'oracle-operator',
    source_ref: event.decision_id,
    document: {
      title: event.title,
      body: event.body,
      content_type: 'operator_grounding',
      metadata: {
        domain: 'oracle',
        sub_type: 'operator_decision',
        decided_at: event.decided_at ?? null,
      },
    },
    chunking_mode: 'hierarchical',
    policy_tags: ['eigenx', 'oracle-operator', 'operator-grounding'],
    entity_ids: event.entity_ids ?? [],
  };
}

export function createOracleOperatorEigenAdapter(config: OracleOperatorAdapterConfig) {
  const ingestClient = createEigenIngestClient(config);

  return {
    async ingestOperatorGrounding(event: OracleOperatorGroundingEvent) {
      const payload = mapOracleOperatorEventToEigenDocument(event);
      if (config.defaultPolicyTags && config.defaultPolicyTags.length > 0) {
        payload.policy_tags = Array.from(new Set([...(payload.policy_tags ?? []), ...config.defaultPolicyTags]));
      }
      return ingestClient.ingest(payload);
    },
  };
}
