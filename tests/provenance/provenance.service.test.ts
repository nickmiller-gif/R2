import { describe, it, expect, vi } from 'vitest';
import {
  createProvenanceService,
  type DbProvenanceEventRow,
  type ProvenanceDb,
} from '../../src/services/provenance/provenance.service.js';
import { genesisChainHash, hashPayload, nextChainHash } from '../../src/lib/provenance/hash.js';

const DOMAIN = 'oracle';

function makeDbRow(entityId: string, override?: Partial<DbProvenanceEventRow>): DbProvenanceEventRow {
  return {
    id: 'evt-1',
    domain: DOMAIN,
    entity_id: entityId,
    event_type: 'entity.created',
    actor_id: 'actor-1',
    actor_kind: 'user',
    payload_hash: 'payload-hash',
    chain_hash: genesisChainHash(entityId),
    metadata: { foo: 'bar' },
    recorded_at: new Date('2024-01-01T00:00:00Z').toISOString(),
    ...override,
  };
}

function makeDb(overrides?: Partial<ProvenanceDb>): ProvenanceDb {
  const row = makeDbRow('ent-1');
  return {
    insertEvent: vi.fn().mockResolvedValue(row),
    queryEvents: vi.fn().mockResolvedValue([row]),
    findLatestForEntity: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('Shared ProvenanceService', () => {
  it('appends a genesis event scoped by domain when none exists', async () => {
    const entityId = 'ent-abc';
    const db = makeDb({
      insertEvent: vi.fn().mockImplementation(async (row) => makeDbRow(entityId, row)),
    });
    const svc = createProvenanceService(db);
    const payload = { hello: 'world' };

    const event = await svc.append({
      domain: DOMAIN,
      entityId,
      eventType: 'entity.created',
      actor: { id: 'actor-1', kind: 'user' },
      payload,
    });

    expect(db.findLatestForEntity).toHaveBeenCalledWith(DOMAIN, entityId);
    const insertCall = vi.mocked(db.insertEvent).mock.calls[0][0];
    expect(insertCall.domain).toBe(DOMAIN);
    expect(insertCall.chain_hash).toBe(genesisChainHash(entityId));
    expect(insertCall.payload_hash).toBe(hashPayload(payload));
    expect(insertCall.metadata).toEqual({});
    expect(event.domain).toBe(DOMAIN);
    expect(event.recordedAt).toBeInstanceOf(Date);
  });

  it('chains events using the previous chain hash within the same domain', async () => {
    const entityId = 'ent-xyz';
    const prevHash = genesisChainHash(entityId);
    const previousRow = makeDbRow(entityId, { chain_hash: prevHash });

    const db = makeDb({
      findLatestForEntity: vi.fn().mockResolvedValue(previousRow),
      insertEvent: vi.fn().mockImplementation(async (row) => makeDbRow(entityId, row)),
    });
    const svc = createProvenanceService(db);
    const payload = { change: 'update' };

    await svc.append({
      domain: DOMAIN,
      entityId,
      eventType: 'entity.updated',
      actor: { id: 'actor-2', kind: 'service' },
      payload,
      metadata: { traceId: 'trace-123' },
    });

    expect(db.findLatestForEntity).toHaveBeenCalledWith(DOMAIN, entityId);
    const insertCall = vi.mocked(db.insertEvent).mock.calls[0][0];
    expect(insertCall.chain_hash).toBe(nextChainHash(prevHash, hashPayload(payload)));
    expect(insertCall.event_type).toBe('entity.updated');
    expect(insertCall.metadata).toEqual({ traceId: 'trace-123' });
  });

  it('maps lookup rows to domain-scoped events', async () => {
    const entityId = 'ent-lookup';
    const row = makeDbRow(entityId);
    const db = makeDb({
      queryEvents: vi.fn().mockResolvedValue([row]),
    });
    const svc = createProvenanceService(db);

    const events = await svc.lookup({ domain: DOMAIN, entityId });

    expect(db.queryEvents).toHaveBeenCalledWith({ domain: DOMAIN, entityId });
    expect(events).toHaveLength(1);
    expect(events[0].domain).toBe(DOMAIN);
    expect(events[0].entityId).toBe(entityId);
    expect(events[0].recordedAt).toBeInstanceOf(Date);
  });

  it('returns null when no latest event exists for an entity', async () => {
    const entityId = 'ent-missing';
    const db = makeDb({
      findLatestForEntity: vi.fn().mockResolvedValue(null),
    });
    const svc = createProvenanceService(db);

    const latest = await svc.getLatestForEntity(DOMAIN, entityId);
    expect(db.findLatestForEntity).toHaveBeenCalledWith(DOMAIN, entityId);
    expect(latest).toBeNull();
  });
});
