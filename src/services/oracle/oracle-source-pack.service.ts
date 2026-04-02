/**
 * Oracle source pack service — manages collections of sources by lane.
 *
 * Source packs organize evidence sources by their lane (internal canonical,
 * external authoritative, etc.) for efficient querying and governance.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  OracleSourcePack,
  CreateOracleSourcePackInput,
  OracleSourcePackFilter,
} from '../../types/oracle/source-pack.js';
import { nowUtc } from '../../lib/provenance/clock.js';

export interface OracleSourcePackService {
  create(input: CreateOracleSourcePackInput): Promise<OracleSourcePack>;
  getById(id: string): Promise<OracleSourcePack | null>;
  list(filter?: OracleSourcePackFilter): Promise<OracleSourcePack[]>;
}

export interface DbOracleSourcePackRow {
  id: string;
  profile_id: string | null;
  name: string;
  source_lane: string;
  source_class: string;
  source_scope: string | null;
  source_ids: string;
  notes: string | null;
  governance: string;
  created_at: string;
  updated_at: string;
}

export interface OracleSourcePackDb {
  insertSourcePack(row: DbOracleSourcePackRow): Promise<DbOracleSourcePackRow>;
  findSourcePackById(id: string): Promise<DbOracleSourcePackRow | null>;
  querySourcePacks(filter?: OracleSourcePackFilter): Promise<DbOracleSourcePackRow[]>;
}

function rowToSourcePack(row: DbOracleSourcePackRow): OracleSourcePack {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    sourceLane: row.source_lane as OracleSourcePack['sourceLane'],
    sourceClass: row.source_class as OracleSourcePack['sourceClass'],
    sourceScope: row.source_scope,
    sourceIds: JSON.parse(row.source_ids),
    notes: row.notes,
    governance: JSON.parse(row.governance),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createOracleSourcePackService(db: OracleSourcePackDb): OracleSourcePackService {
  return {
    async create(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertSourcePack({
        id: crypto.randomUUID(),
        profile_id: input.profileId ?? null,
        name: input.name,
        source_lane: input.sourceLane,
        source_class: input.sourceClass,
        source_scope: input.sourceScope ?? null,
        source_ids: JSON.stringify(input.sourceIds ?? []),
        notes: input.notes ?? null,
        governance: JSON.stringify(input.governance ?? {}),
        created_at: now,
        updated_at: now,
      });
      return rowToSourcePack(row);
    },

    async getById(id) {
      const row = await db.findSourcePackById(id);
      return row ? rowToSourcePack(row) : null;
    },

    async list(filter) {
      const rows = await db.querySourcePacks(filter);
      return rows.map(rowToSourcePack);
    },
  };
}
