export {
  createEigenIngestClient,
  buildIdempotencyKey,
  type EigenIngestClientConfig,
  type EigenIngestRequest,
  type EigenIngestResponse,
  type EigenIngestDocument,
  type EigenMultipartIngestInput,
} from './eigen-ingest-client.js';

export {
  createIpInsightsHubEigenAdapter,
  mapIpEventToEigenDocument,
  type IpAnalysisCompletedEvent,
  type IpAdapterConfig,
} from './ip-insights-hub/eigen-ip-adapter.js';

export {
  createRaysRetreatEigenAdapter,
  mapRaysRetreatEventToEigen,
  mapThoughtPieceToEigen,
  type RaysRetreatContentEvent,
  type ThoughtPieceEvent,
} from './raysretreat/eigen-raysretreat-adapter.js';

export {
  createCentralR2EigenAdapter,
  mapCentralR2EventToEigen,
  type CentralR2KnowledgeEvent,
} from './centralr2-core/eigen-centralr2-adapter.js';

export {
  createR2AppEigenAdapter,
  mapR2AppEventToEigen,
  type R2AppConversationEvent,
} from './r2app/eigen-r2app-adapter.js';

export {
  createHealthSupplementEigenAdapter,
  mapHealthSupplementTrendToEigen,
  type HealthSupplementTrendEvent,
} from './health-supplement-tr/eigen-health-supplement-adapter.js';

export {
  createSmartplrxEigenAdapter,
  mapSmartplrxTrendToEigen,
  type SmartplrxTrendEvent,
} from './smartplrx-trend-tracker/eigen-smartplrx-adapter.js';

export {
  createOracleOperatorEigenAdapter,
  mapOracleOperatorEventToEigenDocument,
  type OracleOperatorGroundingEvent,
  type OracleOperatorAdapterConfig,
} from './oracle-operator/eigen-oracle-operator-adapter.js';

export {
  visibilityPolicyTags,
  type AdapterVisibility,
  type AdapterIngestMetadata,
} from './shared/adapter-metadata.js';

export {
  DOMAIN_ADAPTER_ROADMAP,
  type AdapterRoadmapItem,
} from './domain-adapter-roadmap.js';
