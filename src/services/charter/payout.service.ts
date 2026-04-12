import type {
  CharterPayout,
  CreateCharterPayoutInput,
  UpdateCharterPayoutInput,
  CharterPayoutFilter,
} from '../../types/charter/types.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import { assertConfidence, assertPositiveAmount } from '../../lib/charter/validate.js';

// ─── Service interfaces ────────────────────────────────────────────────────

export interface CharterPayoutService {
  create(input: CreateCharterPayoutInput): Promise<CharterPayout>;
  getById(id: string): Promise<CharterPayout | null>;
  list(filter?: CharterPayoutFilter): Promise<CharterPayout[]>;
  update(id: string, input: UpdateCharterPayoutInput): Promise<CharterPayout>;
  approve(id: string, approvedBy: string): Promise<CharterPayout>;
}

export interface CharterPayoutDb {
  insertPayout(row: DbCharterPayoutRow): Promise<DbCharterPayoutRow>;
  findPayoutById(id: string): Promise<DbCharterPayoutRow | null>;
  queryPayouts(filter?: CharterPayoutFilter): Promise<DbCharterPayoutRow[]>;
  updatePayout(id: string, patch: Partial<DbCharterPayoutRow>): Promise<DbCharterPayoutRow>;
}

export interface DbCharterPayoutRow {
  id: string;
  entity_id: string;
  right_id: string | null;
  obligation_id: string | null;
  amount: number;
  currency: string;
  payout_date: string | null;
  status: string;
  confidence: number;
  approved_by: string | null;
  created_by: string;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPayout(row: DbCharterPayoutRow): CharterPayout {
  return {
    id: row.id,
    entityId: row.entity_id,
    rightId: row.right_id,
    obligationId: row.obligation_id,
    amount: row.amount,
    currency: row.currency,
    payoutDate: row.payout_date ? new Date(row.payout_date) : null,
    status: row.status as CharterPayout['status'],
    approvedBy: row.approved_by,
    confidence: row.confidence,
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createCharterPayoutService(db: CharterPayoutDb): CharterPayoutService {
  return {
    async create(input) {
      assertPositiveAmount(input.amount);
      if (input.confidence !== undefined) assertConfidence(input.confidence);
      const now = nowUtc().toISOString();
      const row = await db.insertPayout({
        id: crypto.randomUUID(),
        entity_id: input.entityId,
        right_id: input.rightId ?? null,
        obligation_id: input.obligationId ?? null,
        amount: input.amount,
        currency: input.currency,
        payout_date: input.payoutDate ?? null,
        status: input.status ?? 'pending',
        confidence: input.confidence ?? 50,
        approved_by: null,
        created_by: input.createdBy,
        reviewed_by: null,
        created_at: now,
        updated_at: now,
      });
      return rowToPayout(row);
    },

    async getById(id) {
      const row = await db.findPayoutById(id);
      return row ? rowToPayout(row) : null;
    },

    async list(filter) {
      const limit = Math.min(filter?.limit ?? 50, 1000);
      const offset = filter?.offset ?? 0;
      const rows = await db.queryPayouts({ ...filter, limit, offset });
      return rows.map(rowToPayout);
    },

    async update(id, input) {
      if (input.amount !== undefined) assertPositiveAmount(input.amount);
      if (input.confidence !== undefined) assertConfidence(input.confidence);
      const patch: Partial<DbCharterPayoutRow> = {
        updated_at: nowUtc().toISOString(),
      };
      if (input.amount !== undefined) patch.amount = input.amount;
      if (input.currency !== undefined) patch.currency = input.currency;
      if (input.payoutDate !== undefined) patch.payout_date = input.payoutDate;
      if (input.status !== undefined) patch.status = input.status;
      if (input.approvedBy !== undefined) patch.approved_by = input.approvedBy;
      if (input.confidence !== undefined) patch.confidence = input.confidence;
      if (input.reviewedBy !== undefined) patch.reviewed_by = input.reviewedBy;
      const row = await db.updatePayout(id, patch);
      return rowToPayout(row);
    },

    async approve(id, approvedBy) {
      const patch: Partial<DbCharterPayoutRow> = {
        status: 'approved',
        approved_by: approvedBy,
        updated_at: nowUtc().toISOString(),
      };
      const row = await db.updatePayout(id, patch);
      return rowToPayout(row);
    },
  };
}
