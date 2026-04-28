import { describe, expect, it } from 'vitest';
import { validateWave1Metadata } from '../../supabase/functions/_shared/wave1-signal-metadata.ts';
import { type R2SignalEnvelope } from '../../packages/r2-signal-contract/src/index.ts';

function validWave1Envelope(
  sourceSystem: 'rays_retreat' | 'operator_workbench' | 'oracle_operator',
): R2SignalEnvelope {
  const now = '2026-04-27T12:00:00.000Z';
  return {
    contract_version: '1.0.0',
    source_system: sourceSystem,
    source_repo: `nickmiller-gif/${sourceSystem}`,
    source_event_type: 'wave1_test',
    actor_meg_entity_id: null,
    related_entity_ids: [],
    event_time: now,
    summary: 'wave1 metadata validation test',
    raw_payload: {
      ingest_run: {
        id: '11111111-1111-4111-8111-111111111111',
        source_system: sourceSystem,
        started_at: now,
        trigger: 'wave1_test',
      },
      evidence_tier: 'C',
      sources_queried: ['test_source'],
      adversarial_pass: true,
      registry_verified_ratio: 0.5,
    },
    confidence: 0.8,
    privacy_level: 'operator',
    provenance: { table: 'tests', row_id: 'row-1' },
    routing_targets: ['oracle'],
    ingest_run_id: '11111111-1111-4111-8111-111111111111',
  };
}

describe('Wave 1 metadata validation', () => {
  it('passes for valid Wave 1 envelope', () => {
    const result = validateWave1Metadata(validWave1Envelope('rays_retreat'));
    expect(result.ok).toBe(true);
  });

  it('skips non-wave1 source systems', () => {
    const envelope = validWave1Envelope('rays_retreat');
    envelope.source_system = 'centralr2';
    const result = validateWave1Metadata(envelope);
    expect(result.ok).toBe(true);
  });

  it('fails when ingest_run is missing', () => {
    const envelope = validWave1Envelope('operator_workbench');
    delete (envelope.raw_payload as Record<string, unknown>).ingest_run;
    const result = validateWave1Metadata(envelope);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('wave1_metadata_missing');
  });

  it('fails when source mismatch occurs', () => {
    const envelope = validWave1Envelope('oracle_operator');
    (envelope.raw_payload as any).ingest_run.source_system = 'rays_retreat';
    const result = validateWave1Metadata(envelope);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('must match source_system');
  });

  it('fails when evidence tier is invalid', () => {
    const envelope = validWave1Envelope('rays_retreat');
    (envelope.raw_payload as any).evidence_tier = 'Z';
    const result = validateWave1Metadata(envelope);
    expect(result.ok).toBe(false);
  });

  it('fails when sources_queried is empty', () => {
    const envelope = validWave1Envelope('rays_retreat');
    (envelope.raw_payload as any).sources_queried = [];
    const result = validateWave1Metadata(envelope);
    expect(result.ok).toBe(false);
  });

  it('fails when adversarial_pass is not boolean', () => {
    const envelope = validWave1Envelope('operator_workbench');
    (envelope.raw_payload as any).adversarial_pass = 'true';
    const result = validateWave1Metadata(envelope);
    expect(result.ok).toBe(false);
  });

  it('fails when registry ratio is out of range', () => {
    const envelope = validWave1Envelope('oracle_operator');
    (envelope.raw_payload as any).registry_verified_ratio = 2;
    const result = validateWave1Metadata(envelope);
    expect(result.ok).toBe(false);
  });
});
