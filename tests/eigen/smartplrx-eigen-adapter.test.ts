import { describe, expect, it } from 'vitest';
import {
  createSmartplrxEigenAdapter,
  mapSmartplrxTrendToEigen,
} from '../../src/adapters/smartplrx-trend-tracker/eigen-smartplrx-adapter.js';

describe('Smartplrx Eigen adapter', () => {
  it('defaults to public corpus with smartplrx tags', () => {
    const payload = mapSmartplrxTrendToEigen({
      trend_id: 'trend-1',
      title: 'Creatine steady state',
      body: 'Body',
      tags: ['supplement-trend'],
    });

    expect(payload.source_system).toBe('smartplrx');
    expect(payload.source_ref).toBe('trend-1');
    expect(payload.document.metadata?.visibility).toBe('public');
    expect(payload.policy_tags).toContain('eigen_public');
    expect(payload.policy_tags).toContain('smartplrx');
  });

  it('uses eigenx when visibility is internal', () => {
    const payload = mapSmartplrxTrendToEigen({
      trend_id: 'trend-2',
      title: 'Operator notes',
      body: 'Private',
      visibility: 'eigenx',
    });

    expect(payload.document.metadata?.visibility).toBe('eigenx');
    expect(payload.policy_tags).toContain('eigenx');
    expect(payload.policy_tags).not.toContain('eigen_public');
  });

  it('forwards mapped payload through ingest wrapper', async () => {
    let capturedBody: unknown = null;
    const adapter = createSmartplrxEigenAdapter({
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
      await adapter.onTrendExported({
        trend_id: 'trend-3',
        title: 'Caffeine taper',
        body: 'Body',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    const payload = capturedBody as {
      source_ref: string;
      document: { metadata?: { site_id?: string } };
    };
    expect(payload.source_ref).toBe('trend-3');
    expect(payload.document.metadata?.site_id).toBe('smartplrx-trend-tracker');
  });
});
