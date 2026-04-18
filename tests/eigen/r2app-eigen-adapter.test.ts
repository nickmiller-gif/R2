import { describe, expect, it } from 'vitest';
import {
  createR2AppEigenAdapter,
  mapR2AppEventToEigen,
} from '../../src/adapters/r2app/eigen-r2app-adapter.js';

describe('R2App Eigen adapter', () => {
  it('maps conversation events with public defaults', () => {
    const payload = mapR2AppEventToEigen({
      event_id: 'evt-1',
      title: 'Conversation',
      transcript: 'Transcript body',
    });

    expect(payload.source_system).toBe('r2app');
    expect(payload.source_ref).toBe('evt-1');
    expect(payload.document.content_type).toBe('conversation_transcript');
    expect(payload.document.metadata?.site_id).toBe('r2app');
    expect(payload.document.metadata?.visibility).toBe('public');
    expect(payload.policy_tags).toContain('eigen_public');
    expect(payload.policy_tags).toContain('engagement');
    expect(payload.entity_ids).toEqual([]);
  });

  it('uses ingest wrapper and keeps explicit eigenx visibility', async () => {
    let capturedBody: unknown = null;
    const adapter = createR2AppEigenAdapter({
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
      await adapter.onConversationCaptured({
        event_id: 'evt-2',
        title: 'Operator conversation',
        transcript: 'Private transcript',
        visibility: 'eigenx',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    const payload = capturedBody as {
      source_ref: string;
      document: { metadata: { visibility: string } };
      policy_tags: string[];
    };
    expect(payload.source_ref).toBe('evt-2');
    expect(payload.document.metadata.visibility).toBe('eigenx');
    expect(payload.policy_tags).toContain('eigenx');
  });
});
