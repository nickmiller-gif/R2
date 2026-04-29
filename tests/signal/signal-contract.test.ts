import { describe, expect, it } from 'vitest';
import {
  SIGNAL_BOUNDS,
  validateR2SignalEnvelope,
} from '../../packages/r2-signal-contract/src/index.ts';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

function validEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
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
    ...overrides,
  };
}

describe('r2 signal contract validator', () => {
  it('accepts a valid envelope', () => {
    const result = validateR2SignalEnvelope(validEnvelope());
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

  it('enforces upper bounds on source_repo and source_event_type', () => {
    const result = validateR2SignalEnvelope(
      validEnvelope({
        source_repo: 'r'.repeat(SIGNAL_BOUNDS.sourceRepoMaxLength + 1),
        source_event_type: 'e'.repeat(SIGNAL_BOUNDS.sourceEventTypeMaxLength + 1),
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.issues.map((i) => i.path);
      expect(paths).toContain('source_repo');
      expect(paths).toContain('source_event_type');
    }
  });

  it('rejects raw_payload above the JSON byte cap', () => {
    const big = 'x'.repeat(SIGNAL_BOUNDS.rawPayloadMaxJsonBytes + 1);
    const result = validateR2SignalEnvelope(validEnvelope({ raw_payload: { blob: big } }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.path === 'raw_payload')).toBe(true);
    }
  });

  it('rejects provenance above the JSON byte cap', () => {
    const big = 'x'.repeat(SIGNAL_BOUNDS.provenanceMaxJsonBytes + 1);
    const result = validateR2SignalEnvelope(validEnvelope({ provenance: { blob: big } }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.path === 'provenance')).toBe(true);
    }
  });

  it('rejects related_entity_ids that exceed the cardinality cap', () => {
    const tooMany = Array.from({ length: SIGNAL_BOUNDS.relatedEntityIdsMax + 1 }, () => VALID_UUID);
    const result = validateR2SignalEnvelope(validEnvelope({ related_entity_ids: tooMany }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.path === 'related_entity_ids')).toBe(true);
    }
  });

  it('requires UUIDs in related_entity_ids and ingest_run_id', () => {
    const result = validateR2SignalEnvelope(
      validEnvelope({
        related_entity_ids: ['not-a-uuid'],
        ingest_run_id: 'also-not-a-uuid',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.issues.map((i) => i.path);
      expect(paths).toContain('related_entity_ids');
      expect(paths).toContain('ingest_run_id');
    }
  });

  it('requires actor_meg_entity_id to be a UUID when non-null', () => {
    const result = validateR2SignalEnvelope(validEnvelope({ actor_meg_entity_id: 'nope' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.path === 'actor_meg_entity_id')).toBe(true);
    }
  });

  it('accepts a UUID actor_meg_entity_id and ingest_run_id', () => {
    const result = validateR2SignalEnvelope(
      validEnvelope({
        actor_meg_entity_id: VALID_UUID,
        related_entity_ids: [VALID_UUID],
        ingest_run_id: VALID_UUID,
      }),
    );
    expect(result.ok).toBe(true);
  });
});
