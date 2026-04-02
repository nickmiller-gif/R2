import type {
  AuditLogEntry,
  AuditReadQuery,
  AuditReadResult,
} from '../../types/charter/audit.js';
import type { GovernanceEntityKind, GovernanceStatus } from '../../types/charter/governance.js';

export interface AuditReadService {
  query(q: AuditReadQuery): Promise<AuditReadResult>;
  getByEventId(eventId: string): Promise<AuditLogEntry | null>;
}

export interface DbAuditLogRow {
  event_id: string;
  recorded_at: string;
  event_type: string;
  actor_id: string;
  actor_kind: string;
  payload_hash: string;
  chain_hash: string;
  metadata: Record<string, unknown>;
  entity_id: string;
  entity_kind: string;
  ref_code: string;
  entity_title: string;
  entity_status: string;
  entity_version: number;
}

export interface AuditReadDb {
  queryAuditLog(q: AuditReadQuery): Promise<{ rows: DbAuditLogRow[]; total: number }>;
  findByEventId(eventId: string): Promise<DbAuditLogRow | null>;
}

function rowToEntry(row: DbAuditLogRow): AuditLogEntry {
  return {
    eventId: row.event_id,
    recordedAt: new Date(row.recorded_at),
    eventType: row.event_type,
    actorId: row.actor_id,
    actorKind: row.actor_kind,
    payloadHash: row.payload_hash,
    chainHash: row.chain_hash,
    metadata: row.metadata,
    entityId: row.entity_id,
    entityKind: row.entity_kind as GovernanceEntityKind,
    refCode: row.ref_code,
    entityTitle: row.entity_title,
    entityStatus: row.entity_status as GovernanceStatus,
    entityVersion: row.entity_version,
  };
}

export function createAuditReadService(db: AuditReadDb): AuditReadService {
  return {
    async query(q) {
      const { rows, total } = await db.queryAuditLog(q);
      return { entries: rows.map(rowToEntry), total };
    },

    async getByEventId(eventId) {
      const row = await db.findByEventId(eventId);
      return row ? rowToEntry(row) : null;
    },
  };
}
