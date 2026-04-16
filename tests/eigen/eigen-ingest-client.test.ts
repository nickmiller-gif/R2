import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildIdempotencyKey,
  createEigenIngestClient,
  type EigenIngestRequest,
} from '../../src/adapters/eigen-ingest-client.js';

const endpoint = 'https://example.com/functions/v1/eigen-ingest';

describe('Eigen ingest client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('builds URL-safe idempotency keys', () => {
    const key = buildIdempotencyKey('My System', 'ref/123');
    expect(key).toBe('My%20System:ref%2F123');
  });

  it('posts JSON ingest payload with auth and idempotency key', async () => {
    const payload: EigenIngestRequest = {
      source_system: 'oracle',
      source_ref: 'run-42',
      document: { title: 'Doc', body: 'Content' },
    };
    let capturedInit: RequestInit | undefined;

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedInit = init;
      return new Response(
        JSON.stringify({
          document_id: 'doc-1',
          ingestion_run_id: 'ingest-1',
          chunks_created: 2,
          embedding_dimensions: 1536,
          oracle_outbox_event_id: null,
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    globalThis.fetch = fetchMock;

    const client = createEigenIngestClient({
      endpoint,
      getAccessToken: async () => 'token-abc',
    });

    await client.ingest(payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capturedInit?.method).toBe('POST');
    expect(capturedInit?.headers).toMatchObject({
      Authorization: 'Bearer token-abc',
      'Content-Type': 'application/json',
      'x-idempotency-key': buildIdempotencyKey(payload.source_system, payload.source_ref),
    });
    expect(JSON.parse(String(capturedInit?.body))).toEqual(payload);
  });

  it('throws when ingest endpoint returns an error', async () => {
    const fetchMock = vi.fn(async () => new Response('failed', { status: 500 })) as typeof fetch;
    globalThis.fetch = fetchMock;

    const client = createEigenIngestClient({
      endpoint,
      getAccessToken: async () => 'token',
    });

    await expect(
      client.ingest({
        source_system: 'oracle',
        source_ref: 'bad-run',
        document: { title: 'Broken', body: 'oops' },
      }),
    ).rejects.toThrow('Eigen ingest failed (500): failed');
  });

  it('sends multipart ingest with defaults and serialized metadata', async () => {
    let capturedInit: RequestInit | undefined;

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedInit = init;
      return new Response(
        JSON.stringify({
          document_id: 'doc-2',
          ingestion_run_id: 'ingest-2',
          chunks_created: 1,
          embedding_dimensions: 1024,
          oracle_outbox_event_id: 'outbox-1',
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    globalThis.fetch = fetchMock;

    const client = createEigenIngestClient({
      endpoint,
      getAccessToken: async () => 'token-xyz',
    });

    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });

    await client.ingestMultipart({
      source_system: 'centralr2-core',
      source_ref: 'src-77',
      file,
      metadata: { tags: ['alpha'] },
      policy_tags: ['internal'],
      entity_ids: ['entity-1'],
      title: 'Note',
      content_type: 'text/plain',
    });

    const headers = capturedInit?.headers as Record<string, string>;
    const form = capturedInit?.body as FormData;

    expect(headers.Authorization).toBe('Bearer token-xyz');
    expect(headers['x-idempotency-key']).toBe(buildIdempotencyKey('centralr2-core', 'src-77'));
    expect(form.get('source_system')).toBe('centralr2-core');
    expect(form.get('source_ref')).toBe('src-77');
    expect(form.get('chunking_mode')).toBe('hierarchical');
    expect(form.get('metadata')).toBe(JSON.stringify({ tags: ['alpha'] }));
    expect(form.get('policy_tags')).toBe(JSON.stringify(['internal']));
    expect(form.get('entity_ids')).toBe(JSON.stringify(['entity-1']));
    expect((form.get('file') as File).name).toBe('note.txt');
  });

  it('throws when multipart ingest fails', async () => {
    const fetchMock = vi.fn(async () => new Response('bad multipart', { status: 502 })) as typeof fetch;
    globalThis.fetch = fetchMock;

    const client = createEigenIngestClient({
      endpoint,
      getAccessToken: async () => 'token',
    });

    await expect(
      client.ingestMultipart({
        source_system: 'centralr2-core',
        source_ref: 'oops',
        file: new File(['oops'], 'oops.txt'),
      }),
    ).rejects.toThrow('Eigen ingest failed (502): bad multipart');
  });
});
