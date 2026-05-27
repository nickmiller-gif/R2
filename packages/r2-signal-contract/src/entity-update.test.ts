import { describe, expect, it } from 'vitest';
import {
  buildEntityUpdateRawPayload,
  buildEntityUpdateSummary,
  computeEntityUpdateSignalKey,
  ENTITY_FIELD_UPDATE_EVENT_TYPE,
  parseEntityUpdatePayload,
} from './entity-update.ts';

describe('entity-update contract', () => {
  it('parses valid entity update payload', () => {
    const raw = buildEntityUpdateRawPayload({
      megEntityId: '00000000-0000-4000-8000-000000000001',
      fieldPatch: { name: 'Acme Corp', industry: 'Tech' },
      sourceRevision: 'rev-1',
      sourceTable: 'clients',
      sourceRowId: 'client-1',
    });
    const parsed = parseEntityUpdatePayload(raw as unknown as Record<string, unknown>);
    expect(parsed?.meg_entity_id).toBe('00000000-0000-4000-8000-000000000001');
    expect(parsed?.field_patch.name).toBe('Acme Corp');
    expect(parsed?.source_revision).toBe('rev-1');
  });

  it('rejects empty field patch', () => {
    const parsed = parseEntityUpdatePayload({
      entity_update: true,
      meg_entity_id: '00000000-0000-4000-8000-000000000001',
      field_patch: {},
      source_revision: 'rev-1',
    });
    expect(parsed).toBeNull();
  });

  it('builds deterministic signal keys', () => {
    const key = computeEntityUpdateSignalKey(
      'operator_workbench',
      '00000000-0000-4000-8000-000000000001',
      'rev-abc',
    );
    expect(key).toBe(
      'operator_workbench:entity_field_update:00000000-0000-4000-8000-000000000001:rev-abc',
    );
    expect(ENTITY_FIELD_UPDATE_EVENT_TYPE).toBe('entity_field_update');
  });

  it('truncates summary to contract max', () => {
    const longPatch = { name: 'x'.repeat(300) };
    const summary = buildEntityUpdateSummary(longPatch, 'ip_pulse_point');
    expect(summary.length).toBeLessThanOrEqual(280);
  });
});
