import { describe, expect, it, vi } from 'vitest';
import { emitR2Signal } from '../../packages/r2-producer-sdk/src/index.ts';
import { SIGNAL_CONTRACT_VERSION } from '../../packages/r2-signal-contract/src/index.ts';

describe('emitR2Signal', () => {
  it('validates, signs, and posts a minimal envelope', async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL, _init?: RequestInit) =>
        new Response('{"ok":true}', { status: 200 }),
    );
    const fetchImpl = fetchMock as unknown as typeof fetch;
    const result = await emitR2Signal(
      {
        contract_version: SIGNAL_CONTRACT_VERSION,
        source_system: 'r2chart',
        source_repo: 'nickmiller-gif/continuity-nexus',
        source_event_type: 'kb_four_smoke',
        actor_meg_entity_id: null,
        related_entity_ids: [],
        event_time: '2026-05-17T12:00:00.000Z',
        summary: 'smoke',
        raw_payload: { smoke: true },
        confidence: 0.5,
        privacy_level: 'operator',
        provenance: {},
        routing_targets: ['oracle'],
      },
      {
        ingestUrl: 'https://example.com/r2-signal-ingest',
        bearer: 'test-bearer',
        hmacSecret: 'a'.repeat(64),
        idempotencyKey: 'r2chart:smoke:1',
        fetchImpl,
      },
    );

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-bearer');
    expect(headers['x-idempotency-key']).toBe('r2chart:smoke:1');
    expect(headers['x-r2-signature']).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects invalid envelopes without calling fetch', async () => {
    const fetchMock = vi.fn();
    const fetchImpl = fetchMock as unknown as typeof fetch;
    const result = await emitR2Signal(
      {
        contract_version: SIGNAL_CONTRACT_VERSION,
        source_system: 'not_a_literal' as 'r2chart',
        source_repo: 'x',
        source_event_type: 'x',
        actor_meg_entity_id: null,
        related_entity_ids: [],
        event_time: 'bad',
        summary: '',
        raw_payload: {},
        confidence: 2,
        privacy_level: 'operator',
        provenance: {},
        routing_targets: [],
      },
      {
        ingestUrl: 'https://example.com',
        bearer: 'b',
        hmacSecret: 'c',
        idempotencyKey: 'k',
        fetchImpl,
      },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect('validation' in result).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
