/**
 * Memory Entry Service — segmented memory with retention and confidence.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  MemoryEntry,
  MemoryScope,
  CreateMemoryEntryInput,
  UpdateMemoryEntryInput,
  MemoryEntryFilter,
} from '../../types/eigen/memory-entry.js';
import { nowUtc } from '../../lib/provenance/clock.js';

export interface MemoryEntryService {
  create(input: CreateMemoryEntryInput): Promise<MemoryEntry>;
  getById(id: string): Promise<MemoryEntry | null>;
  list(filter?: MemoryEntryFilter): Promise<MemoryEntry[]>;
  update(id: string, input: UpdateMemoryEntryInput): Promise<MemoryEntry>;
  getByKey(scope: MemoryScope, ownerId: string, key: string): Promise<MemoryEntry | null>;
  supersede(id: string, newId: string): Promise<MemoryEntry>;
}

export interface DbMemoryEntryRow {
  id: string;
  scope: string;
  key: string;
  value: string;
  retention_class: string;
  expires_at: string | null;
  confidence_band: string;
  conflict_group: string | null;
  superseded_by: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface MemoryEntryDb {
  insertEntry(row: DbMemoryEntryRow): Promise<DbMemoryEntryRow>;
  findEntryById(id: string): Promise<DbMemoryEntryRow | null>;
  queryEntries(filter?: MemoryEntryFilter): Promise<DbMemoryEntryRow[]>;
  updateEntry(id: string, patch: Partial<DbMemoryEntryRow>): Promise<DbMemoryEntryRow>;
}

function rowToEntry(row: DbMemoryEntryRow): MemoryEntry {
  return {
    id: row.id,
    scope: row.scope as MemoryEntry['scope'],
    key: row.key,
    value: JSON.parse(row.value),
    retentionClass: row.retention_class as MemoryEntry['retentionClass'],
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    confidenceBand: row.confidence_band,
    conflictGroup: row.conflict_group,
    supersededBy: row.superseded_by,
    ownerId: row.owner_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createMemoryEntryService(db: MemoryEntryDb): MemoryEntryService {
  return {
    async create(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertEntry({
        id: crypto.randomUUID(),
        scope: input.scope,
        key: input.key,
        value: JSON.stringify(input.value),
        retention_class: input.retentionClass ?? 'short_term',
        expires_at: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
        confidence_band: input.confidenceBand ?? 'medium',
        conflict_group: null,
        superseded_by: null,
        owner_id: input.ownerId,
        created_at: now,
        updated_at: now,
      });
      return rowToEntry(row);
    },

    async getById(id) {
      const row = await db.findEntryById(id);
      return row ? rowToEntry(row) : null;
    },

    async list(filter) {
      const rows = await db.queryEntries(filter);
      return rows.map(rowToEntry);
    },

    async update(id, input) {
      const now = nowUtc().toISOString();
      const patch: Partial<DbMemoryEntryRow> = {
        updated_at: now,
      };
      if (input.value !== undefined) patch.value = JSON.stringify(input.value);
      if (input.retentionClass !== undefined) patch.retention_class = input.retentionClass;
      if (input.expiresAt !== undefined)
        patch.expires_at = input.expiresAt ? new Date(input.expiresAt).toISOString() : null;
      if (input.confidenceBand !== undefined) patch.confidence_band = input.confidenceBand;
      if (input.supersededBy !== undefined) patch.superseded_by = input.supersededBy;

      const row = await db.updateEntry(id, patch);
      return rowToEntry(row);
    },

    async getByKey(scope, ownerId, key) {
      const rows = await db.queryEntries({ scope, ownerId, key });
      return rows.length > 0 ? rowToEntry(rows[0]) : null;
    },

    async supersede(id, newId) {
      const row = await db.updateEntry(id, {
        superseded_by: newId,
      });
      return rowToEntry(row);
    },
  };
}
