export type SignalContractVersion = '1.0.0';

export type R2SignalSourceSystem =
  | 'rays_retreat'
  | 'centralr2'
  | 'operator_workbench'
  | 'oracle_operator'
  | 'autonomous_bot_os'
  | 'cloudflare_agent_chatbot'
  | 'forma_health'
  | 'health_supplement_tr'
  | 'smartplrx'
  | 'smartplrx_trend_tracker'
  | 'ip_insights_hub'
  | 'hpseller'
  | 'open_intel_commons'
  | 'insr'
  | 'r2_widget'
  | 'plrx_external';

export type R2SignalPrivacyLevel = 'public' | 'members' | 'operator' | 'private';

export type R2SignalRoutingTarget =
  | 'oracle'
  | 'eigen'
  | 'charter'
  | 'operator_workbench'
  | 'meg'
  | 'commons_publish';

export type R2SignalProvenance = {
  url?: string;
  row_id?: string;
  table?: string;
  [k: string]: unknown;
};

export type R2SignalEnvelope = {
  contract_version: SignalContractVersion;
  source_system: R2SignalSourceSystem;
  source_repo: string;
  source_event_type: string;
  actor_meg_entity_id: string | null;
  related_entity_ids: string[];
  event_time: string;
  summary: string;
  raw_payload: Record<string, unknown>;
  confidence: number;
  privacy_level: R2SignalPrivacyLevel;
  provenance: R2SignalProvenance;
  routing_targets: R2SignalRoutingTarget[];
  ingest_run_id?: string;
};

export const SIGNAL_CONTRACT_VERSION: SignalContractVersion = '1.0.0';

export const R2_SIGNAL_SOURCE_SYSTEMS: readonly R2SignalSourceSystem[] = [
  'rays_retreat',
  'centralr2',
  'operator_workbench',
  'oracle_operator',
  'autonomous_bot_os',
  'cloudflare_agent_chatbot',
  'forma_health',
  'health_supplement_tr',
  'smartplrx',
  'smartplrx_trend_tracker',
  'ip_insights_hub',
  'hpseller',
  'open_intel_commons',
  'insr',
  'r2_widget',
  'plrx_external',
];

export const R2_SIGNAL_PRIVACY_LEVELS: readonly R2SignalPrivacyLevel[] = [
  'public',
  'members',
  'operator',
  'private',
];

export const R2_SIGNAL_ROUTING_TARGETS: readonly R2SignalRoutingTarget[] = [
  'oracle',
  'eigen',
  'charter',
  'operator_workbench',
  'meg',
  'commons_publish',
];
