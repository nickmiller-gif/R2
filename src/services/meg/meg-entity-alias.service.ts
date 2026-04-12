/**
 * MEG Entity Alias service — alternative identifiers for MEG entities.
 *
 * Aliases are the primary lookup surface for entity resolution across
 * domains. Each alias carries a kind, value, source, and confidence.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  MegEntityAlias,
  CreateMegEntityAliasInput,
  MegEntityAliasFilter,
} from '../../types/meg/entity-alias.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import { parseJsonbField } from '../oracle/oracle-db-utils.js';

export interface MegEntityAliasService {
  create(input: CreateMegEntityAliasInput): Promise<MegEntityAlias>;
  getById(id: string): Promise<MegEntityAlias | null>;
  list(filter?: MegEntityAliasFilter): Promise<MegEntityAlias[]>;
  resolve(aliasValue: string): Promise<MegEntityAlias[]>;
  deleteById(id: string): Promise<void>;
}

export interface DbMegEntityAliasRow {
  id: string;
  meg_entity_id: string;
  alias_kind: string;
  alias_value: string;
  source: string | null;
  confidence: number;
  metadata: string;
  created_at: string;
}

export interface MegEntityAliasDb {
  insertAlias(row: DbMegEntityAliasRow): Promise<DbMegEntityAliasRow>;
  findAliasById(id: string): Promise<DbMegEntityAliasRow | null>;
  queryAliases(filter?: MegEntityAliasFilter): Promise<DbMegEntityAliasRow[]>;
  findByValue(aliasValue: string): Promise<DbMegEntityAliasRow[]>;
  deleteAlias(id: string): Promise<void>;
}

function rowToAlias(row: DbMegEntityAliasRow): MegEntityAlias {
  return {
    id: row.id,
    megEntityId: row.meg_entity_id,
    aliasKind: row.alias_kind as MegEntityAlias['aliasKind'],
    aliasValue: row.alias_value,
    source: row.source,
    confidence: row.confidence,
    metadata: parseJsonbField(row.metadata),
    createdAt: new Date(row.created_at),
  };
}

export function createMegEntityAliasService(db: MegEntityAliasDb): MegEntityAliasService {
  return {
    async create(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertAlias({
        id: crypto.randomUUID(),
        meg_entity_id: input.megEntityId,
        alias_kind: input.aliasKind,
        alias_value: input.aliasValue,
        source: input.source ?? null,
        confidence: input.confidence ?? 100,
        metadata: JSON.stringify(input.metadata ?? {}),
        created_at: now,
      });
      return rowToAlias(row);
    },

    async getById(id) {
      const row = await db.findAliasById(id);
      return row ? rowToAlias(row) : null;
    },

    async list(filter) {
      const rows = await db.queryAliases(filter);
      return rows.map(rowToAlias);
    },

    async resolve(aliasValue) {
      const rows = await db.findByValue(aliasValue);
      return rows.map(rowToAlias);
    },

    async deleteById(id) {
      await db.deleteAlias(id);
    },
  };
}
