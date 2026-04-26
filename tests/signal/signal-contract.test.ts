import { describe, expect, it } from 'vitest';
import { validateR2SignalEnvelope } from '../../packages/r2-signal-contract/src/index.ts';

describe('r2 signal contract validator', () => {
  it('accepts a valid envelope', () => {
    const result = validateR2SignalEnvelope({
      contract_version: '1.0.0',
      source_system: 'centralr2',
      source_repo: 'nickmiller-gif/centralr2-core',
      source_event_type: 'client_enriched',
      actor_meg_entity_id: null,
      related_entity_ids: [],
      event_time: '2026-04-26T09:30:00Z',
      summary: 'Client enriched with latest registry and market context.',
      raw_payload: { client_id: 'client-1' },
      confidence: 0.82,
      privacy_level: 'operator',
      provenance: { table: 'ci_clients', row_id: 'client-1' },
      routing_targets: ['oracle', 'eigen'],
    });

    expect(result.ok).toBe(true);
  });

  it('rejects malformed envelope fields', () => {
    const result = validateR2SignalEnvelope({
      contract_version: '0.9.0',
      source_system: 'unknown',
      source_repo: '',
      source_event_type: '',
      actor_meg_entity_id: 123,
      related_entity_ids: [1, 2],
      event_time: 'not-a-date',
      summary: 'x'.repeat(281),
      raw_payload: [],
      confidence: 2,
      privacy_level: 'secret',
      provenance: null,
      routing_targets: ['invalid-target'],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.issues.map((issue) => issue.path);
      expect(paths).toContain('contract_version');
      expect(paths).toContain('source_system');
      expect(paths).toContain('confidence');
      expect(paths).toContain('routing_targets');
    }
  });
});
