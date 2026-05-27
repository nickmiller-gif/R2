import { describe, expect, it } from 'vitest';
import {
  buildEntityUpdateRawPayload,
  computeEntityUpdateSignalKey,
  ENTITY_FIELD_UPDATE_EVENT_TYPE,
  ENTITY_UPDATED_PROJECTION_EVENT_TYPE,
  isEntityFieldUpdateEvent,
  isEntityUpdatedProjectionEvent,
  parseEntityUpdatePayload,
} from '../packages/r2-signal-contract/src/entity-update.ts';

const MEG_ID = '00000000-0000-4000-8000-000000000099';

describe('entity sync propagation contract', () => {
  it('accepts valid field update payload', () => {
    const raw = buildEntityUpdateRawPayload({
      megEntityId: MEG_ID,
      fieldPatch: { name: 'Acme', industry: 'Pharma' },
      sourceRevision: 'works:rev:1',
      sourceTable: 'clients',
      sourceRowId: 'client-uuid',
    });
    const parsed = parseEntityUpdatePayload(raw as unknown as Record<string, unknown>);
    expect(parsed).not.toBeNull();
    expect(parsed?.field_patch.name).toBe('Acme');
  });

  it('uses deterministic idempotency keys per revision', () => {
    const a = computeEntityUpdateSignalKey('ip_pulse_point', MEG_ID, 'rev-1');
    const b = computeEntityUpdateSignalKey('ip_pulse_point', MEG_ID, 'rev-2');
    expect(a).not.toBe(b);
    expect(a).toContain(ENTITY_FIELD_UPDATE_EVENT_TYPE);
  });

  it('distinguishes ingest vs projection event types', () => {
    expect(isEntityFieldUpdateEvent(ENTITY_FIELD_UPDATE_EVENT_TYPE)).toBe(true);
    expect(isEntityUpdatedProjectionEvent(ENTITY_UPDATED_PROJECTION_EVENT_TYPE)).toBe(true);
    expect(isEntityFieldUpdateEvent(ENTITY_UPDATED_PROJECTION_EVENT_TYPE)).toBe(false);
  });

  it('rejects stale duplicate revision shape without fields', () => {
    const parsed = parseEntityUpdatePayload({
      entity_update: true,
      meg_entity_id: MEG_ID,
      field_patch: { name: 'Only' },
      source_revision: '',
    });
    expect(parsed).toBeNull();
  });
});
