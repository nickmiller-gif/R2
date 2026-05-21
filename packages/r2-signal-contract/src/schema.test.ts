import { describe, expect, it } from 'vitest';
import { normalizeR2SignalEnvelope, validateR2SignalEnvelope } from './schema.ts';

const baseEnvelope = {
  contract_version: '1.0.0',
  source_system: 'centralr2',
  source_repo: 'nickmiller-gif/centralr2-core',
  source_event_type: 'knowledge_event',
  related_entity_ids: [],
  event_time: '2026-05-20T12:00:00.000Z',
  summary: 'Test signal',
  raw_payload: {},
  confidence: 0.5,
  privacy_level: 'operator',
  provenance: {},
  routing_targets: ['oracle'],
};

describe('normalizeR2SignalEnvelope', () => {
  it('coerces missing actor_meg_entity_id to null', () => {
    const out = normalizeR2SignalEnvelope({
      ...baseEnvelope,
      actor_meg_entity_id: undefined,
    }) as Record<string, unknown>;
    expect(out.actor_meg_entity_id).toBeNull();
    const validated = validateR2SignalEnvelope(out);
    expect(validated.ok).toBe(true);
  });

  it('tags synthetic smokes in provenance', () => {
    const out = normalizeR2SignalEnvelope({
      ...baseEnvelope,
      actor_meg_entity_id: null,
      source_event_type: 'kb_four_smoke',
      summary: 'KB-four smoke',
    }) as Record<string, unknown>;
    expect((out.provenance as Record<string, unknown>).is_synthetic).toBe(true);
  });
});
