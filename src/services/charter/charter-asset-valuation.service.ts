import type {
  CharterAssetValuation,
  CharterAssetValuationFilter,
  CharterValuationKind,
  CharterValuationStatus,
  CreateCharterAssetValuationInput,
  UpdateCharterAssetValuationInput,
} from '../../types/charter/types.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import {
  assertConfidence,
  assertNonEmpty,
  assertNonNegativeAmountNumeric,
} from '../../lib/charter/validate.js';

function requireReviewerWhenActive(status: string, reviewedBy: string | null | undefined): void {
  if (status === 'active' && (!reviewedBy || String(reviewedBy).trim() === '')) {
    throw new Error('status "active" requires reviewedBy (reviewer user id)');
  }
}

export interface CharterAssetValuationService {
  create(input: CreateCharterAssetValuationInput): Promise<CharterAssetValuation>;
  getById(id: string): Promise<CharterAssetValuation | null>;
  list(filter?: CharterAssetValuationFilter): Promise<CharterAssetValuation[]>;
  update(id: string, input: UpdateCharterAssetValuationInput): Promise<CharterAssetValuation>;
}

export interface CharterAssetValuationDb {
  insertRow(row: DbCharterAssetValuationRow): Promise<DbCharterAssetValuationRow>;
  findById(id: string): Promise<DbCharterAssetValuationRow | null>;
  query(filter?: CharterAssetValuationFilter): Promise<DbCharterAssetValuationRow[]>;
  updateRow(id: string, patch: Partial<DbCharterAssetValuationRow>): Promise<DbCharterAssetValuationRow>;
}

export interface DbCharterAssetValuationRow {
  id: string;
  meg_entity_id: string;
  charter_entity_id: string | null;
  valuation_kind: string;
  amount_numeric: string;
  currency: string;
  as_of: string;
  confidence: number;
  methodology: string | null;
  basis_notes: string | null;
  /** JSON string from mocks; Supabase/PostgREST often returns parsed jsonb objects. */
  metadata: string | Record<string, unknown>;
  status: string;
  supersedes_id: string | null;
  created_by: string;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeMetadataFromDb(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== 'string' || raw.trim() === '') return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function rowToValuation(row: DbCharterAssetValuationRow): CharterAssetValuation {
  return {
    id: row.id,
    megEntityId: row.meg_entity_id,
    charterEntityId: row.charter_entity_id,
    valuationKind: row.valuation_kind as CharterValuationKind,
    amountNumeric: String(row.amount_numeric),
    currency: row.currency,
    asOf: new Date(row.as_of),
    confidence: row.confidence,
    methodology: row.methodology,
    basisNotes: row.basis_notes,
    metadata: normalizeMetadataFromDb(row.metadata),
    status: row.status as CharterValuationStatus,
    supersedesId: row.supersedes_id,
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createCharterAssetValuationService(db: CharterAssetValuationDb): CharterAssetValuationService {
  return {
    async create(input) {
      assertNonNegativeAmountNumeric(input.amountNumeric);
      if (input.confidence !== undefined) assertConfidence(input.confidence);
      const initialStatus = input.status ?? 'draft';
      const reviewer = input.reviewedBy ?? null;
      requireReviewerWhenActive(initialStatus, reviewer);
      if (reviewer) assertNonEmpty(reviewer, 'reviewedBy');
      const now = nowUtc().toISOString();
      const row = await db.insertRow({
        id: crypto.randomUUID(),
        meg_entity_id: input.megEntityId,
        charter_entity_id: input.charterEntityId ?? null,
        valuation_kind: input.valuationKind,
        amount_numeric: input.amountNumeric.trim(),
        currency: (input.currency ?? 'USD').trim() || 'USD',
        as_of: input.asOf,
        confidence: input.confidence ?? 50,
        methodology: input.methodology ?? null,
        basis_notes: input.basisNotes ?? null,
        metadata: JSON.stringify(input.metadata ?? {}),
        status: initialStatus,
        supersedes_id: input.supersedesId ?? null,
        created_by: input.createdBy,
        reviewed_by: reviewer,
        created_at: now,
        updated_at: now,
      });
      return rowToValuation(row);
    },

    async getById(id) {
      const row = await db.findById(id);
      return row ? rowToValuation(row) : null;
    },

    async list(filter) {
      const rows = await db.query(filter);
      return rows.map(rowToValuation);
    },

    async update(id, input) {
      const current = await db.findById(id);
      if (!current) throw new Error(`Valuation not found: ${id}`);

      if (input.amountNumeric !== undefined) assertNonNegativeAmountNumeric(input.amountNumeric);
      if (input.confidence !== undefined) assertConfidence(input.confidence);
      if (input.reviewedBy !== undefined && input.reviewedBy !== null) {
        assertNonEmpty(input.reviewedBy, 'reviewedBy');
      }

      const nextStatus = input.status ?? current.status;
      const nextReviewed =
        input.reviewedBy !== undefined ? input.reviewedBy : current.reviewed_by;
      requireReviewerWhenActive(nextStatus, nextReviewed);

      const patch: Partial<DbCharterAssetValuationRow> = {
        updated_at: nowUtc().toISOString(),
      };
      if (input.charterEntityId !== undefined) patch.charter_entity_id = input.charterEntityId;
      if (input.valuationKind !== undefined) patch.valuation_kind = input.valuationKind;
      if (input.amountNumeric !== undefined) patch.amount_numeric = input.amountNumeric.trim();
      if (input.currency !== undefined) patch.currency = input.currency.trim() || 'USD';
      if (input.asOf !== undefined) patch.as_of = input.asOf;
      if (input.methodology !== undefined) patch.methodology = input.methodology;
      if (input.basisNotes !== undefined) patch.basis_notes = input.basisNotes;
      if (input.metadata !== undefined) patch.metadata = JSON.stringify(input.metadata);
      if (input.status !== undefined) patch.status = input.status;
      if (input.supersedesId !== undefined) patch.supersedes_id = input.supersedesId;
      if (input.confidence !== undefined) patch.confidence = input.confidence;
      if (input.reviewedBy !== undefined) patch.reviewed_by = input.reviewedBy;
      const row = await db.updateRow(id, patch);
      return rowToValuation(row);
    },
  };
}
