/**
 * Domain-agnostic provenance service.
 *
 * Generalized from the Charter-scoped provenance service.
 * Any domain (Charter, Oracle, Eigen) can append immutable,
 * chain-hashed provenance events through this service.
 *
 * The `domain` field on each event ensures provenance streams
 * are scoped — Charter events don't mix with Oracle events.
 */

import type {
  ProvenanceEvent,
  AppendProvenanceInput,
  ProvenanceLookupFilter,
} from '../../types/shared/provenance.js';
import { hashPayload, nextChainHash, genesisChainHash } from '../../lib/provenance/hash.js';
import { nowUtc } from '../../lib/provenance/clock.js';

export interface ProvenanceService {
  append(input: AppendProvenanceInput): Promise<ProvenanceEvent>;
  lookup(filter: ProvenanceLookupFilter): Promise<ProvenanceEvent[]>;
  getLatestForEntity(domain: string, entityId: string): Promise<ProvenanceEvent | null>;
}

export interface DbProvenanceEventRow {
  id: string;
  domain: string;
  entity_id: string;
  event_type: string;
  actor_id: string;
  actor_kind: string;
  payload_hash: string;
  chain_hash: string;
  metadata: Record<string, unknown>;
  recorded_at: string;
}

export interface ProvenanceDb {
  insertEvent(row: DbProvenanceEventRow): Promise<DbProvenanceEventRow>;
  queryEvents(filter: ProvenanceLookupFilter): Promise<DbProvenanceEventRow[]>;
  findLatestForEntity(domain: string, entityId: string): Promise<DbProvenanceEventRow | null>;
}

function rowToEvent(row: DbProvenanceEventRow): ProvenanceEvent {
  return {
    id: row.id,
    domain: row.domain,
    entityId: row.entity_id,
    eventType: row.event_type,
    actor: { id: row.actor_id, kind: row.actor_kind as ProvenanceEvent['actor']['kind'] },
    payloadHash: row.payload_hash,
    chainHash: row.chain_hash,
    metadata: row.metadata,
    recordedAt: new Date(row.recorded_at),
  };
}

export function createProvenanceService(db: ProvenanceDb): ProvenanceService {
  return {
    async append(input) {
      const payloadHash = hashPayload(input.payload);
      const latest = await db.findLatestForEntity(input.domain, input.entityId);
      const chainHash = latest
        ? nextChainHash(latest.chain_hash, payloadHash)
        : genesisChainHash(input.entityId);

      const row = await db.insertEvent({
        id: crypto.randomUUID(),
        domain: input.domain,
        entity_id: input.entityId,
        event_type: input.eventType,
        actor_id: input.actor.id,
        actor_kind: input.actor.kind,
        payload_hash: payloadHash,
        chain_hash: chainHash,
        metadata: input.metadata ?? {},
        recorded_at: nowUtc().toISOString(),
      });

      return rowToEvent(row);
    },

    async lookup(filter) {
      const rows = await db.queryEvents(filter);
      return rows.map(rowToEvent);
    },

    async getLatestForEntity(domain, entityId) {
      const row = await db.findLatestForEntity(domain, entityId);
      return row ? rowToEvent(row) : null;
    },
  };
}
