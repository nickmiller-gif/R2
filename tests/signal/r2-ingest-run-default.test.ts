import { describe, expect, it, vi } from 'vitest';
import { resolveIngestRunIdAndProvenance } from '../../supabase/functions/_shared/r2-ingest-run-default.ts';
import { type R2SignalEnvelope } from '../../packages/r2-signal-contract/src/index.ts';

function wave1Envelope(omitTopLevelRunId: boolean): R2SignalEnvelope {
  const now = '2026-05-05T12:00:00.000Z';
  const runId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const base: R2SignalEnvelope = {
    contract_version: '1.0.0',
    source_system: 'operator_workbench',
    source_repo: 'nickmiller-gif/operator_workbench',
    source_event_type: 'smoke_omit_ingest_run_id',
    actor_meg_entity_id: null,
    related_entity_ids: [],
    event_time: now,
    summary: 'omit ingest_run_id test',
    raw_payload: {
      ingest_run: {
        id: runId,
        source_system: 'operator_workbench',
        started_at: now,
        trigger: 'test',
      },
      evidence_tier: 'C',
      sources_queried: ['s'],
      adversarial_pass: true,
      registry_verified_ratio: 0.5,
    },
    confidence: 0.8,
    privacy_level: 'operator',
    provenance: { table: 'smoke' },
    routing_targets: ['oracle'],
  };
  if (!omitTopLevelRunId) {
    return { ...base, ingest_run_id: runId };
  }
  return base;
}

describe('resolveIngestRunIdAndProvenance', () => {
  it('leaves provenance unchanged when ingest_run_id is provided', () => {
    const env = wave1Envelope(false);
    const r = resolveIngestRunIdAndProvenance(env);
    expect(r.ingestRunId).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(r.provenance).toEqual({ table: 'smoke' });
  });

  it('Wave 1 omit uses payload id and stamps _r2 wave1_payload', () => {
    const env = wave1Envelope(true);
    const r = resolveIngestRunIdAndProvenance(env);
    expect(r.ingestRunId).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(r.provenance._r2).toMatchObject({ ingest_run_source: 'wave1_payload' });
    expect(typeof (r.provenance._r2 as Record<string, unknown>).server_default_at).toBe('string');
  });

  it('non-Wave1 omit uses random UUID and stamps _r2 server_default', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    const env: R2SignalEnvelope = {
      ...wave1Envelope(true),
      source_system: 'centralr2',
      source_repo: 'nickmiller-gif/centralr2-core',
      raw_payload: { note: 'not wave1 shape' },
    };
    const r = resolveIngestRunIdAndProvenance(env);
    expect(r.ingestRunId).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    expect(r.provenance._r2).toMatchObject({ ingest_run_source: 'server_default' });
    vi.restoreAllMocks();
  });
});
