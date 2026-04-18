import { describe, expect, it } from 'vitest';
import {
  createCentralR2EigenAdapter,
  mapCentralR2EventToEigen,
} from '../../src/adapters/centralr2-core/eigen-centralr2-adapter.js';

describe('CentralR2 Eigen adapter', () => {
  it('maps a CentralR2 knowledge event to Eigen ingest payload defaults', () => {
    const payload = mapCentralR2EventToEigen({
      asset_id: 'asset-1',
      title: 'Asset narrative',
      narrative: 'Narrative body',
    });

    expect(payload.source_system).toBe('centralr2-core');
    expect(payload.source_ref).toBe('asset-1');
    expect(payload.document.content_type).toBe('asset_narrative');
    expect(payload.document.metadata?.site_id).toBe('centralr2-core');
    expect(payload.document.metadata?.visibility).toBe('eigenx');
    expect(payload.policy_tags).toContain('eigenx');
    expect(payload.policy_tags).toContain('asset-intel');
    expect(payload.entity_ids).toEqual([]);
  });

  it('uses ingest wrapper to forward mapped payload', async () => {
    let capturedBody: unknown = null;
    const adapter = createCentralR2EigenAdapter({
      endpoint: 'https://example.com/functions/v1/eigen-ingest',
      getAccessToken: async () => 'token',
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      capturedBody = init?.body ? JSON.parse(String(init.body)) : null;
      return new Response(
        JSON.stringify({
          document_id: 'doc-1',
          ingestion_run_id: 'run-1',
          chunks_created: 1,
          embedding_dimensions: 1536,
          oracle_outbox_event_id: null,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      await adapter.onKnowledgeUpdated({
        asset_id: 'asset-2',
        title: 'Updated asset',
        narrative: 'Updated narrative',
        entity_ids: ['ent-1'],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    const payload = capturedBody as { source_ref: string; entity_ids: string[] };
    expect(payload.source_ref).toBe('asset-2');
    expect(payload.entity_ids).toEqual(['ent-1']);
  });
});
