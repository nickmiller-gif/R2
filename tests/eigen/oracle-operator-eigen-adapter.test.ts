import { describe, expect, it } from 'vitest';
import {
  createOracleOperatorEigenAdapter,
  mapOracleOperatorEventToEigenDocument,
} from '../../src/adapters/oracle-operator/eigen-oracle-operator-adapter.js';

describe('Oracle operator Eigen adapter', () => {
  it('maps operator grounding event with defaults', () => {
    const payload = mapOracleOperatorEventToEigenDocument({
      decision_id: 'decision-1',
      title: 'Operator decision',
      body: 'Grounding body',
    });

    expect(payload.source_system).toBe('oracle_operator');
    expect(payload.source_ref).toBe('decision-1');
    expect(payload.document.content_type).toBe('operator_grounding');
    expect(payload.document.metadata?.decided_at).toBeNull();
    expect(payload.policy_tags).toEqual(['eigenx', 'oracle-operator', 'operator-grounding']);
    expect(payload.entity_ids).toEqual([]);
  });

  it('merges defaultPolicyTags and deduplicates while forwarding ingest payload', async () => {
    let capturedBody: unknown = null;
    const adapter = createOracleOperatorEigenAdapter({
      endpoint: 'https://example.com/functions/v1/eigen-ingest',
      getAccessToken: async () => 'token',
      defaultPolicyTags: ['oracle-operator', 'ops-review'],
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
      await adapter.ingestOperatorGrounding({
        decision_id: 'decision-2',
        title: 'Escalation',
        body: 'Decision text',
        decided_at: '2026-01-01T00:00:00.000Z',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    const payload = capturedBody as {
      source_ref: string;
      policy_tags: string[];
      document: { metadata?: { decided_at?: string | null } };
    };
    expect(payload.source_ref).toBe('decision-2');
    expect(payload.document.metadata?.decided_at).toBe('2026-01-01T00:00:00.000Z');
    expect(payload.policy_tags).toContain('eigenx');
    expect(payload.policy_tags).toContain('oracle-operator');
    expect(payload.policy_tags).toContain('operator-grounding');
    expect(payload.policy_tags).toContain('ops-review');
    expect(payload.policy_tags.filter((tag) => tag === 'oracle-operator')).toHaveLength(1);
  });
});
