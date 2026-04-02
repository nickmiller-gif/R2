import { describe, it, expect, vi } from 'vitest';
import { createProvenanceService } from '../../src/services/charter/provenance.service.js';
import type { ProvenanceDb, DbProvenanceEventRow } from '../../src/services/charter/provenance.service.js';
import { makeAppendProvenanceInput, makeProvenanceEvent } from './fixtures/governance-fixtures.js';
import { hashPayload, genesisChainHash } from '../../src/lib/provenance/hash.js';

function makeDbRow(entityId: string, override?: Partial<DbProvenanceEventRow>): DbProvenanceEventRow {
  return {
    id: 'evt-1',
    entity_id: entityId,
    event_type: 'entity.created',
    actor_id: 'user-actor-1',
    actor_kind: 'user',
    payload_hash: 'abc123',
    chain_hash: genesisChainHash(entityId),
    metadata: {},
    recorded_at: new Date().toISOString(),
    ...override,
  };
}

function makeDb(entityId: string, overrides?: Partial<ProvenanceDb>): ProvenanceDb {
  const row = makeDbRow(entityId);
  return {
    insertEvent: vi.fn().mockResolvedValue(row),
    queryEvents: vi.fn().mockResolvedValue([row]),
    findLatestForEntity: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('ProvenanceService', () => {
  it('appends a genesis provenance event (no previous)', async () => {
    const entityId = 'ent-abc';
    const db = makeDb(entityId);
    const svc = createProvenanceService(db);
    const input = makeAppendProvenanceInput(entityId);

    const event = await svc.append(input);

    expect(db.insertEvent).toHaveBeenCalledOnce();
    const call = vi.mocked(db.insertEvent).mock.calls[0][0];
    expect(call.chain_hash).toBe(genesisChainHash(entityId));
    expect(call.payload_hash).toBe(hashPayload(input.payload));
    expect(event.entityId).toBe(entityId);
  });

  it('chains provenance events correctly', async () => {
    const entityId = 'ent-xyz';
    const prevHash = genesisChainHash(entityId);
    const prevRow = makeDbRow(entityId, { chain_hash: prevHash });

    const db = makeDb(entityId, {
      findLatestForEntity: vi.fn().mockResolvedValue(prevRow),
      insertEvent: vi.fn().mockResolvedValue(makeDbRow(entityId)),
    });
    const svc = createProvenanceService(db);
    const input = makeAppendProvenanceInput(entityId, { eventType: 'entity.updated' });

    await svc.append(input);

    const call = vi.mocked(db.insertEvent).mock.calls[0][0];
    expect(call.chain_hash).not.toBe(prevHash);
    expect(call.event_type).toBe('entity.updated');
  });

  it('looks up events by filter', async () => {
    const entityId = 'ent-abc';
    const db = makeDb(entityId);
    const svc = createProvenanceService(db);

    const events = await svc.lookup({ entityId });

    expect(db.queryEvents).toHaveBeenCalledWith({ entityId });
    expect(events).toHaveLength(1);
    expect(events[0].entityId).toBe(entityId);
  });

  it('returns latest event for entity', async () => {
    const entityId = 'ent-abc';
    const row = makeDbRow(entityId);
    const db = makeDb(entityId, {
      findLatestForEntity: vi.fn().mockResolvedValue(row),
    });
    const svc = createProvenanceService(db);

    const latest = await svc.getLatestForEntity(entityId);
    expect(latest).not.toBeNull();
    expect(latest!.entityId).toBe(entityId);
  });

  it('returns null when no provenance exists for entity', async () => {
    const entityId = 'ent-new';
    const db = makeDb(entityId, {
      findLatestForEntity: vi.fn().mockResolvedValue(null),
    });
    const svc = createProvenanceService(db);

    const latest = await svc.getLatestForEntity(entityId);
    expect(latest).toBeNull();
  });
});
