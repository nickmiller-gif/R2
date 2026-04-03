import type {
  CharterObligation,
  CreateCharterObligationInput,
  UpdateCharterObligationInput,
  CharterObligationFilter,
} from '../../types/charter/types.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import { assertConfidence } from '../../lib/charter/validate.js';

// ─── Service interfaces ────────────────────────────────────────────────────

export interface CharterObligationService {
  create(input: CreateCharterObligationInput): Promise<CharterObligation>;
  getById(id: string): Promise<CharterObligation | null>;
  list(filter?: CharterObligationFilter): Promise<CharterObligation[]>;
  update(id: string, input: UpdateCharterObligationInput): Promise<CharterObligation>;
}

export interface CharterObligationDb {
  insertObligation(row: DbCharterObligationRow): Promise<DbCharterObligationRow>;
  findObligationById(id: string): Promise<DbCharterObligationRow | null>;
  queryObligations(filter?: CharterObligationFilter): Promise<DbCharterObligationRow[]>;
  updateObligation(id: string, patch: Partial<DbCharterObligationRow>): Promise<DbCharterObligationRow>;
}

export interface DbCharterObligationRow {
  id: string;
  entity_id: string;
  right_id: string | null;
  obligation_type: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  confidence: number;
  created_by: string;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

function rowToObligation(row: DbCharterObligationRow): CharterObligation {
  return {
    id: row.id,
    entityId: row.entity_id,
    rightId: row.right_id,
    obligationType: row.obligation_type as CharterObligation['obligationType'],
    title: row.title,
    description: row.description,
    dueDate: row.due_date ? new Date(row.due_date) : null,
    status: row.status as CharterObligation['status'],
    confidence: row.confidence,
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createCharterObligationService(db: CharterObligationDb): CharterObligationService {
  return {
    async create(input) {
      if (input.confidence !== undefined) assertConfidence(input.confidence);
      const now = nowUtc().toISOString();
      const row = await db.insertObligation({
        id: crypto.randomUUID(),
        entity_id: input.entityId,
        right_id: input.rightId ?? null,
        obligation_type: input.obligationType,
        title: input.title,
        description: input.description ?? null,
        due_date: input.dueDate ?? null,
        status: input.status ?? 'pending',
        confidence: input.confidence ?? 50,
        created_by: input.createdBy,
        reviewed_by: null,
        created_at: now,
        updated_at: now,
      });
      return rowToObligation(row);
    },

    async getById(id) {
      const row = await db.findObligationById(id);
      return row ? rowToObligation(row) : null;
    },

    async list(filter) {
      const rows = await db.queryObligations(filter);
      return rows.map(rowToObligation);
    },

    async update(id, input) {
      if (input.confidence !== undefined) assertConfidence(input.confidence);
      const patch: Partial<DbCharterObligationRow> = {
        updated_at: nowUtc().toISOString(),
      };
      if (input.obligationType !== undefined) patch.obligation_type = input.obligationType;
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.dueDate !== undefined) patch.due_date = input.dueDate;
      if (input.status !== undefined) patch.status = input.status;
      if (input.confidence !== undefined) patch.confidence = input.confidence;
      if (input.reviewedBy !== undefined) patch.reviewed_by = input.reviewedBy;
      const row = await db.updateObligation(id, patch);
      return rowToObligation(row);
    },
  };
}
