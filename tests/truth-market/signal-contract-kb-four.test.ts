import { describe, expect, it } from 'vitest';
import {
  R2_SIGNAL_SOURCE_SYSTEMS,
  validateR2SignalEnvelope,
} from '../../packages/r2-signal-contract/src/index.ts';

const KB_FOUR = ['centralr2', 'operator_workbench', 'r2chart', 'ip_pulse_point'] as const;

describe('KB-four signal contract literals', () => {
  it('includes all four driver source_system values', () => {
    for (const literal of KB_FOUR) {
      expect(R2_SIGNAL_SOURCE_SYSTEMS).toContain(literal);
    }
  });

  it('accepts a minimal r2chart envelope', () => {
    const result = validateR2SignalEnvelope({
      contract_version: '1.0.0',
      source_system: 'r2chart',
      source_repo: 'nickmiller-gif/continuity-nexus',
      source_event_type: 'continuity_probe',
      actor_meg_entity_id: null,
      related_entity_ids: [],
      event_time: new Date().toISOString(),
      summary: 'R2Chart continuity probe signal',
      raw_payload: { workspace_id: 'test' },
      confidence: 0.5,
      privacy_level: 'operator',
      provenance: { table: 'continuity_signal_items' },
      routing_targets: ['oracle', 'meg'],
    });
    expect(result.ok).toBe(true);
  });
});
