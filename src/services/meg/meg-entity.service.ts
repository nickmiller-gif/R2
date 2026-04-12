/**
 * MEG Entity service — canonical identity nodes in the Master Entity Graph.
 *
 * Every real-world entity (person, org, property, product, concept) gets a
 * single MEG node. Domain objects reference MEG entities to unify identity
 * across Oracle, Charter, and Eigen.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  MegEntity,
  CreateMegEntityInput,
  UpdateMegEntityInput,
  MegEntityFilter,
} from '../../types/meg/entity.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import { parseJsonbField } from '../oracle/oracle-db-utils.js';

export interface MegEntityService {
  create(input: CreateMegEntityInput): Promise<MegEntity>;
  getById(id: string): Promise<MegEntity | null>;
  list(filter?: MegEntityFilter): Promise<MegEntity[]>;
  update(id: string, input: UpdateMegEntityInput): Promise<MegEntity>;
  merge(sourceId: string, targetId: string): Promise<MegEntity>;
  archive(id: string): Promise<MegEntity>;
}

export interface DbMegEntityRow {
  id: string;
  profile_id: string | null;
  entity_type: string;
  canonical_name: string;
  status: string;
  merged_into_id: string | null;
  external_ids: string;
  attributes: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface MegEntityDb {
  insertEntity(row: DbMegEntityRow): Promise<DbMegEntityRow>;
  findEntityById(id: string): Promise<DbMegEntityRow | null>;
  queryEntities(filter?: MegEntityFilter): Promise<DbMegEntityRow[]>;
  updateEntity(id: string, patch: Partial<DbMegEntityRow>): Promise<DbMegEntityRow>;
}

/** JSONB map stored as string values in MEG (external system ids). */
function parseExternalIdsJson(json: string): Record<string, string> {
  const raw = parseJsonbField(json);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = typeof v === 'string' ? v : v == null ? '' : String(v);
  }
  return out;
}

function rowToEntity(row: DbMegEntityRow): MegEntity {
  return {
    id: row.id,
    profileId: row.profile_id,
    entityType: row.entity_type as MegEntity['entityType'],
    canonicalName: row.canonical_name,
    status: row.status as MegEntity['status'],
    mergedIntoId: row.merged_into_id,
    externalIds: parseExternalIdsJson(row.external_ids),
    attributes: parseJsonbField(row.attributes),
    metadata: parseJsonbField(row.metadata),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createMegEntityService(db: MegEntityDb): MegEntityService {
  return {
    async create(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertEntity({
        id: crypto.randomUUID(),
        profile_id: input.profileId ?? null,
        entity_type: input.entityType,
        canonical_name: input.canonicalName,
        status: 'active',
        merged_into_id: null,
        external_ids: JSON.stringify(input.externalIds ?? {}),
        attributes: JSON.stringify(input.attributes ?? {}),
        metadata: JSON.stringify(input.metadata ?? {}),
        created_at: now,
        updated_at: now,
      });
      return rowToEntity(row);
    },

    async getById(id) {
      const row = await db.findEntityById(id);
      return row ? rowToEntity(row) : null;
    },

    async list(filter) {
      const limit = Math.min(filter?.limit ?? 50, 1000);
      const offset = filter?.offset ?? 0;
      const rows = await db.queryEntities({ ...filter, limit, offset });
      return rows.map(rowToEntity);
    },

    async update(id, input) {
      const now = nowUtc().toISOString();
      const patch: Partial<DbMegEntityRow> = { updated_at: now };
      if (input.canonicalName !== undefined) patch.canonical_name = input.canonicalName;
      if (input.entityType !== undefined) patch.entity_type = input.entityType;
      if (input.status !== undefined) patch.status = input.status;
      if (input.externalIds !== undefined) patch.external_ids = JSON.stringify(input.externalIds);
      if (input.attributes !== undefined) patch.attributes = JSON.stringify(input.attributes);
      if (input.metadata !== undefined) patch.metadata = JSON.stringify(input.metadata);

      const row = await db.updateEntity(id, patch);
      return rowToEntity(row);
    },

    async merge(sourceId, targetId) {
      const now = nowUtc().toISOString();
      const row = await db.updateEntity(sourceId, {
        status: 'merged',
        merged_into_id: targetId,
        updated_at: now,
      });
      return rowToEntity(row);
    },

    async archive(id) {
      const now = nowUtc().toISOString();
      const row = await db.updateEntity(id, {
        status: 'archived',
        updated_at: now,
      });
      return rowToEntity(row);
    },
  };
}
