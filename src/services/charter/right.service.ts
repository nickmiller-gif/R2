import type {
  CharterRight,
  CreateCharterRightInput,
  UpdateCharterRightInput,
  CharterRightFilter,
} from '../../types/charter/types.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import { assertConfidence } from '../../lib/charter/validate.js';

// ─── Service interfaces ────────────────────────────────────────────────────

export interface CharterRightService {
  create(input: CreateCharterRightInput): Promise<CharterRight>;
  getById(id: string): Promise<CharterRight | null>;
  list(filter?: CharterRightFilter): Promise<CharterRight[]>;
  update(id: string, input: UpdateCharterRightInput): Promise<CharterRight>;
}

export interface CharterRightDb {
  insertRight(row: DbCharterRightRow): Promise<DbCharterRightRow>;
  findRightById(id: string): Promise<DbCharterRightRow | null>;
  queryRights(filter?: CharterRightFilter): Promise<DbCharterRightRow[]>;
  updateRight(id: string, patch: Partial<DbCharterRightRow>): Promise<DbCharterRightRow>;
}

export interface DbCharterRightRow {
  id: string;
  entity_id: string;
  right_type: string;
  title: string;
  description: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  status: string;
  confidence: number;
  created_by: string;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

function rowToRight(row: DbCharterRightRow): CharterRight {
  return {
    id: row.id,
    entityId: row.entity_id,
    rightType: row.right_type as CharterRight['rightType'],
    title: row.title,
    description: row.description,
    effectiveDate: row.effective_date ? new Date(row.effective_date) : null,
    expiryDate: row.expiry_date ? new Date(row.expiry_date) : null,
    status: row.status as CharterRight['status'],
    confidence: row.confidence,
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createCharterRightService(db: CharterRightDb): CharterRightService {
  return {
    async create(input) {
      if (input.confidence !== undefined) assertConfidence(input.confidence);
      const now = nowUtc().toISOString();
      const row = await db.insertRight({
        id: crypto.randomUUID(),
        entity_id: input.entityId,
        right_type: input.rightType,
        title: input.title,
        description: input.description ?? null,
        effective_date: input.effectiveDate ?? null,
        expiry_date: input.expiryDate ?? null,
        status: input.status ?? 'pending',
        confidence: input.confidence ?? 50,
        created_by: input.createdBy,
        reviewed_by: null,
        created_at: now,
        updated_at: now,
      });
      return rowToRight(row);
    },

    async getById(id) {
      const row = await db.findRightById(id);
      return row ? rowToRight(row) : null;
    },

    async list(filter) {
      const limit = Math.min(filter?.limit ?? 50, 1000);
      const offset = filter?.offset ?? 0;
      const rows = await db.queryRights({ ...filter, limit, offset });
      return rows.map(rowToRight);
    },

    async update(id, input) {
      if (input.confidence !== undefined) assertConfidence(input.confidence);
      const patch: Partial<DbCharterRightRow> = {
        updated_at: nowUtc().toISOString(),
      };
      if (input.rightType !== undefined) patch.right_type = input.rightType;
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.effectiveDate !== undefined) patch.effective_date = input.effectiveDate;
      if (input.expiryDate !== undefined) patch.expiry_date = input.expiryDate;
      if (input.status !== undefined) patch.status = input.status;
      if (input.confidence !== undefined) patch.confidence = input.confidence;
      if (input.reviewedBy !== undefined) patch.reviewed_by = input.reviewedBy;
      const row = await db.updateRight(id, patch);
      return rowToRight(row);
    },
  };
}
