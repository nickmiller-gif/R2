/**
 * MEG Entity Edge service — typed relationships between MEG entities.
 *
 * Edges model the graph structure: ownership, employment, subsidiary,
 * partnership, location, and domain-specific relationships.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  MegEntityEdge,
  CreateMegEntityEdgeInput,
  UpdateMegEntityEdgeInput,
  MegEntityEdgeFilter,
} from '../../types/meg/entity-edge.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import { parseJsonbField } from '../oracle/oracle-db-utils.js';
import { withPagination } from '../../lib/service-utils/pagination.js';

export interface MegEntityEdgeService {
  create(input: CreateMegEntityEdgeInput): Promise<MegEntityEdge>;
  getById(id: string): Promise<MegEntityEdge | null>;
  list(filter?: MegEntityEdgeFilter): Promise<MegEntityEdge[]>;
  update(id: string, input: UpdateMegEntityEdgeInput): Promise<MegEntityEdge>;
  deleteById(id: string): Promise<void>;
}

export interface DbMegEntityEdgeRow {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  edge_type: string;
  confidence: number;
  valid_from: string | null;
  valid_to: string | null;
  source: string | null;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface MegEntityEdgeDb {
  insertEdge(row: DbMegEntityEdgeRow): Promise<DbMegEntityEdgeRow>;
  findEdgeById(id: string): Promise<DbMegEntityEdgeRow | null>;
  queryEdges(filter?: MegEntityEdgeFilter): Promise<DbMegEntityEdgeRow[]>;
  updateEdge(id: string, patch: Partial<DbMegEntityEdgeRow>): Promise<DbMegEntityEdgeRow>;
  deleteEdge(id: string): Promise<void>;
}

function rowToEdge(row: DbMegEntityEdgeRow): MegEntityEdge {
  return {
    id: row.id,
    sourceEntityId: row.source_entity_id,
    targetEntityId: row.target_entity_id,
    edgeType: row.edge_type as MegEntityEdge['edgeType'],
    confidence: row.confidence,
    validFrom: row.valid_from ? new Date(row.valid_from) : null,
    validTo: row.valid_to ? new Date(row.valid_to) : null,
    source: row.source,
    metadata: parseJsonbField(row.metadata),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createMegEntityEdgeService(db: MegEntityEdgeDb): MegEntityEdgeService {
  return {
    async create(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertEdge({
        id: crypto.randomUUID(),
        source_entity_id: input.sourceEntityId,
        target_entity_id: input.targetEntityId,
        edge_type: input.edgeType,
        confidence: input.confidence ?? 100,
        valid_from: input.validFrom ?? null,
        valid_to: input.validTo ?? null,
        source: input.source ?? null,
        metadata: JSON.stringify(input.metadata ?? {}),
        created_at: now,
        updated_at: now,
      });
      return rowToEdge(row);
    },

    async getById(id) {
      const row = await db.findEdgeById(id);
      return row ? rowToEdge(row) : null;
    },

    async list(filter) {
      const rows = await db.queryEdges(withPagination(filter));
      return rows.map(rowToEdge);
    },

    async update(id, input) {
      const now = nowUtc().toISOString();
      const patch: Partial<DbMegEntityEdgeRow> = { updated_at: now };
      if (input.confidence !== undefined) patch.confidence = input.confidence;
      if (input.validFrom !== undefined) patch.valid_from = input.validFrom;
      if (input.validTo !== undefined) patch.valid_to = input.validTo;
      if (input.metadata !== undefined) patch.metadata = JSON.stringify(input.metadata);

      const row = await db.updateEdge(id, patch);
      return rowToEdge(row);
    },

    async deleteById(id) {
      await db.deleteEdge(id);
    },
  };
}
