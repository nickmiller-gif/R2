import type {
  ProvenanceEvent,
  AppendProvenanceInput,
  ProvenanceLookupFilter,
} from '../../types/charter/provenance.js';
import { hashPayload, nextChainHash, genesisChainHash } from '../../lib/provenance/hash.js';
import { nowUtc } from '../../lib/provenance/clock.js';

export interface ProvenanceService {
  append(input: AppendProvenanceInput): Promise<ProvenanceEvent>;
  lookup(filter: ProvenanceLookupFilter): Promise<ProvenanceEvent[]>;
  getLatestForEntity(entityId: string): Promise<ProvenanceEvent | null>;
}

export interface DbProvenanceEventRow {
  id: string;
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
  findLatestForEntity(entityId: string): Promise<DbProvenanceEventRow | null>;
}

function rowToEvent(row: DbProvenanceEventRow): ProvenanceEvent {
  return {
    id: row.id,
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
      const latest = await db.findLatestForEntity(input.entityId);
      const chainHash = latest
        ? nextChainHash(latest.chain_hash, payloadHash)
        : genesisChainHash(input.entityId);

      const row = await db.insertEvent({
        id: crypto.randomUUID(),
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

    async getLatestForEntity(entityId) {
      const row = await db.findLatestForEntity(entityId);
      return row ? rowToEvent(row) : null;
    },
  };
}
