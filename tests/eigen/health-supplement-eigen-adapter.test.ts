import { describe, expect, it } from 'vitest';
import {
  createHealthSupplementEigenAdapter,
  mapHealthSupplementTrendToEigen,
} from '../../src/adapters/health-supplement-tr/eigen-health-supplement-adapter.js';

describe('Health Supplement Eigen adapter', () => {
  it('defaults visibility to public and includes eigen_public tag', () => {
    const payload = mapHealthSupplementTrendToEigen({
      trend_id: 'trend-1',
      title: 'Ashwagandha momentum',
      body: 'Trend body',
      tags: ['trend-intelligence'],
    });

    expect(payload.source_system).toBe('health_supplement_tr');
    expect(payload.source_ref).toBe('trend-1');
    expect(payload.document.metadata?.visibility).toBe('public');
    expect(payload.policy_tags).toContain('eigen_public');
    expect(payload.policy_tags).toContain('trend-intelligence');
  });

  it('uses eigenx tag when visibility is explicitly internal', () => {
    const payload = mapHealthSupplementTrendToEigen({
      trend_id: 'trend-2',
      title: 'Internal model notes',
      body: 'Operator-only note',
      visibility: 'eigenx',
      tags: ['operator-notes'],
    });

    expect(payload.document.metadata?.visibility).toBe('eigenx');
    expect(payload.policy_tags).toContain('eigenx');
    expect(payload.policy_tags).not.toContain('eigen_public');
    expect(payload.policy_tags).toContain('operator-notes');
  });

  it('forwards mapped payload through ingest wrapper', async () => {
    let capturedBody: unknown = null;
    const adapter = createHealthSupplementEigenAdapter({
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
        title: 'Magnesium spike',
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
    expect(payload.document.metadata?.site_id).toBe('health-supplement-tr');
  });
});
