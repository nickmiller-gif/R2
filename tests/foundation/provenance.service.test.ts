/**
 * Tests for the generalized (domain-agnostic) provenance service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createProvenanceService,
  type ProvenanceDb,
  type DbProvenanceEventRow,
} from '../../src/services/provenance/provenance.service.js';
import type { ProvenanceLookupFilter } from '../../src/types/shared/provenance.js';
import { hashPayload, genesisChainHash, nextChainHash } from '../../src/lib/provenance/hash.js';
import { makeActor, resetFixtureCounter } from './fixtures/foundation-fixtures.js';

function makeMockDb(): ProvenanceDb & { rows: DbProvenanceEventRow[] } {
  const rows: DbProvenanceEventRow[] = [];
  return {
    rows,
    async insertEvent(row) {
      rows.push(row);
      return row;
    },
    async queryEvents(filter: ProvenanceLookupFilter) {
      return rows.filter((r) => {
        if (filter.domain && r.domain !== filter.domain) return false;
        if (filter.entityId && r.entity_id !== filter.entityId) return false;
        if (filter.actorId && r.actor_id !== filter.actorId) return false;
        if (filter.eventType && r.event_type !== filter.eventType) return false;
        return true;
      });
    },
    async findLatestForEntity(domain: string, entityId: string) {
      const matching = rows
        .filter((r) => r.domain === domain && r.entity_id === entityId)
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
      return matching[0] ?? null;
    },
  };
}

describe('ProvenanceService (generalized)', () => {
  beforeEach(() => resetFixtureCounter());

  it('creates genesis event with correct chain hash', async () => {
    const db = makeMockDb();
    const service = createProvenanceService(db);
    const actor = makeActor();

    const event = await service.append({
      domain: 'oracle',
      entityId: 'entity-1',
      eventType: 'signal.created',
      actor,
      payload: { score: 75 },
    });

    expect(event.domain).toBe('oracle');
    expect(event.entityId).toBe('entity-1');
    expect(event.eventType).toBe('signal.created');
    expect(event.chainHash).toBe(genesisChainHash('entity-1'));
    expect(event.payloadHash).toBe(hashPayload({ score: 75 }));
  });

  it('chains subsequent events correctly', async () => {
    const db = makeMockDb();
    const service = createProvenanceService(db);
    const actor = makeActor();

    const first = await service.append({
      domain: 'charter',
      entityId: 'entity-2',
      eventType: 'governance.created',
      actor,
      payload: { title: 'Policy A' },
    });

    const second = await service.append({
      domain: 'charter',
      entityId: 'entity-2',
      eventType: 'governance.transitioned',
      actor,
      payload: { toStatus: 'active' },
    });

    const expectedChain = nextChainHash(first.chainHash, second.payloadHash);
    expect(second.chainHash).toBe(expectedChain);
  });

  it('keeps domain provenance streams separate', async () => {
    const db = makeMockDb();
    const service = createProvenanceService(db);
    const actor = makeActor();

    await service.append({
      domain: 'charter',
      entityId: 'shared-entity',
      eventType: 'governance.created',
      actor,
      payload: { a: 1 },
    });

    const oracleEvent = await service.append({
      domain: 'oracle',
      entityId: 'shared-entity',
      eventType: 'signal.scored',
      actor,
      payload: { b: 2 },
    });

    // Oracle event should get its own genesis hash, not chain off Charter's
    expect(oracleEvent.chainHash).toBe(genesisChainHash('shared-entity'));
  });

  it('filters lookup by domain', async () => {
    const db = makeMockDb();
    const service = createProvenanceService(db);
    const actor = makeActor();

    await service.append({ domain: 'charter', entityId: 'e1', eventType: 'a', actor, payload: {} });
    await service.append({ domain: 'oracle', entityId: 'e1', eventType: 'b', actor, payload: {} });

    const charterEvents = await service.lookup({ domain: 'charter' });
    expect(charterEvents).toHaveLength(1);
    expect(charterEvents[0].domain).toBe('charter');

    const oracleEvents = await service.lookup({ domain: 'oracle' });
    expect(oracleEvents).toHaveLength(1);
    expect(oracleEvents[0].domain).toBe('oracle');
  });

  it('returns null for missing entity', async () => {
    const db = makeMockDb();
    const service = createProvenanceService(db);

    const result = await service.getLatestForEntity('oracle', 'nonexistent');
    expect(result).toBeNull();
  });
});
