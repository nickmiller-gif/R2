import {
  createEigenIngestClient,
  type EigenIngestClientConfig,
  type EigenIngestRequest,
} from "../eigen-ingest-client.js";
import {
  visibilityPolicyTags,
  type AdapterVisibility,
} from "../shared/adapter-metadata.js";

export interface SmartplrxTrendEvent {
  trend_id: string;
  title: string;
  body: string;
  site_id?: string;
  visibility?: AdapterVisibility;
  content_type?: string;
  tags?: string[];
  entity_ids?: string[];
  captured_at?: string;
  source_table?: string;
}

export function mapSmartplrxTrendToEigen(
  event: SmartplrxTrendEvent,
): EigenIngestRequest {
  const visibility = event.visibility ?? "public";
  const baseTags = ["smartplrx", "trend-intelligence"];
  const policyTags = [...baseTags, ...(event.tags ?? [])];
  return {
    source_system: "smartplrx",
    source_ref: event.trend_id,
    document: {
      title: event.title,
      body: event.body,
      content_type: event.content_type ?? "trend_report",
      metadata: {
        site_id: event.site_id ?? "smartplrx-trend-tracker",
        source_system: "smartplrx",
        source_ref: event.trend_id,
        source_table: event.source_table ?? null,
        visibility,
        captured_at: event.captured_at ?? null,
      },
    },
    chunking_mode: "hierarchical",
    policy_tags: visibilityPolicyTags(visibility, policyTags),
    entity_ids: event.entity_ids ?? [],
  };
}

export function createSmartplrxEigenAdapter(
  config: EigenIngestClientConfig,
) {
  const ingestClient = createEigenIngestClient(config);
  return {
    async onTrendExported(event: SmartplrxTrendEvent) {
      return ingestClient.ingest(mapSmartplrxTrendToEigen(event));
    },
  };
}
