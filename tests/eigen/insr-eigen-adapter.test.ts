import { describe, expect, it } from 'vitest';
import {
  createInsrEigenAdapter,
  mapInsrValidationCompleteToEigen,
} from '../../src/adapters/insr/eigen-insr-adapter.js';

describe('INSR Eigen adapter', () => {
  it('maps validation event with eigenx defaults and truncates title', () => {
    const payload = mapInsrValidationCompleteToEigen({
      batch_id: 'batch-1',
      submission_id: 'submission-1',
      summary: 'A'.repeat(600),
      body: 'Validation details',
    });

    expect(payload.source_system).toBe('insr');
    expect(payload.source_ref).toBe('validation_batch:batch-1');
    expect(payload.document.title).toHaveLength(512);
    expect(payload.document.content_type).toBe('insr_validation_summary');
    expect(payload.document.metadata?.visibility).toBe('eigenx');
    expect(payload.policy_tags).toContain('eigenx');
    expect(payload.policy_tags).toContain('insr');
    expect(payload.policy_tags).toContain('validation-complete');
    expect(payload.entity_ids).toEqual([]);
  });

  it('uses explicit public visibility and forwards ingest payload', async () => {
    let capturedBody: unknown = null;
    const adapter = createInsrEigenAdapter({
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
          chunks_created: 2,
          embedding_dimensions: 1536,
          oracle_outbox_event_id: null,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      await adapter.onValidationComplete({
        batch_id: 'batch-2',
        submission_id: 'submission-2',
        summary: 'Public digest',
        body: 'Summary body',
        visibility: 'public',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    const payload = capturedBody as {
      source_ref: string;
      policy_tags: string[];
      document: { metadata?: { visibility?: string } };
    };
    expect(payload.source_ref).toBe('validation_batch:batch-2');
    expect(payload.document.metadata?.visibility).toBe('public');
    expect(payload.policy_tags).toContain('eigen_public');
    expect(payload.policy_tags).not.toContain('eigenx');
  });
});
