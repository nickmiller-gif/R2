import { describe, expect, it } from 'vitest';
import {
  mapIpEventToEigenDocument,
  createIpInsightsHubEigenAdapter,
} from '../../src/adapters/ip-insights-hub/eigen-ip-adapter.js';

describe('IP Insights Hub Eigen adapter', () => {
  it('maps domain event to Eigen ingest contract', () => {
    const payload = mapIpEventToEigenDocument({
      analysis_run_id: 'run-123',
      analysis_title: 'LNP Patent Map',
      full_analysis_text: 'Full analysis body',
      entity_ids: ['entity-1'],
      generated_at: '2026-04-07T00:00:00.000Z',
    });

    expect(payload.source_system).toBe('ip-insights-hub');
    expect(payload.source_ref).toBe('run-123');
    expect(payload.document.title).toBe('LNP Patent Map');
    expect(payload.document.content_type).toBe('analysis_report');
    expect(payload.chunking_mode).toBe('hierarchical');
    expect(payload.policy_tags).toEqual(['ip-confidential', 'ip-analysis', 'ip-landscape']);
    expect(payload.entity_ids).toEqual(['entity-1']);
    expect(payload.meg_entity_id).toBe('entity-1');
  });

  it('uses explicit meg_entity_id when provided', () => {
    const payload = mapIpEventToEigenDocument({
      analysis_run_id: 'run-9',
      analysis_title: 'T',
      full_analysis_text: 'B',
      entity_ids: ['a', 'b'],
      meg_entity_id: '00000000-0000-4000-8000-000000000001',
    });
    expect(payload.meg_entity_id).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('appends default policy tags in adapter config', async () => {
    let capturedBody: unknown = null;

    const adapter = createIpInsightsHubEigenAdapter({
      endpoint: 'https://example.com/functions/v1/eigen-ingest',
      getAccessToken: async () => 'token',
      defaultPolicyTags: ['extra-tag'],
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      capturedBody = init?.body ? JSON.parse(String(init.body)) : null;
      return new Response(
        JSON.stringify({
          document_id: 'doc-1',
          ingestion_run_id: 'run-1',
          chunks_created: 3,
          embedding_dimensions: 1536,
          oracle_outbox_event_id: null,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      await adapter.onAnalysisCompleted({
        analysis_run_id: 'run-1',
        analysis_title: 'title',
        full_analysis_text: 'body',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    const policyTags = (capturedBody as { policy_tags: string[] }).policy_tags;
    expect(policyTags).toContain('ip-confidential');
    expect(policyTags).toContain('extra-tag');
  });
});
