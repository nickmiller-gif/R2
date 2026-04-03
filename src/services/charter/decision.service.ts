import type {
  CharterDecision,
  DecisionType,
  DecisionStatus,
  DecisionLinkedTable,
  CreateCharterDecisionInput,
  UpdateCharterDecisionInput,
  CharterDecisionFilter,
} from '../../types/charter/types.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import { assertConfidence } from '../../lib/charter/validate.js';

// ─── Service interfaces ────────────────────────────────────────────────────

export interface CharterDecisionService {
  create(input: CreateCharterDecisionInput): Promise<CharterDecision>;
  getById(id: string): Promise<CharterDecision | null>;
  list(filter?: CharterDecisionFilter): Promise<CharterDecision[]>;
  update(id: string, input: UpdateCharterDecisionInput): Promise<CharterDecision>;
}

export interface CharterDecisionDb {
  insertDecision(row: DbCharterDecisionRow): Promise<DbCharterDecisionRow>;
  findDecisionById(id: string): Promise<DbCharterDecisionRow | null>;
  queryDecisions(filter?: CharterDecisionFilter): Promise<DbCharterDecisionRow[]>;
  updateDecision(id: string, patch: Partial<DbCharterDecisionRow>): Promise<DbCharterDecisionRow>;
}

export interface DbCharterDecisionRow {
  id: string;
  linked_table: DecisionLinkedTable;
  linked_id: string;
  decision_type: DecisionType;
  title: string;
  rationale: string | null;
  outcome: Record<string, unknown>;
  decided_by: string | null;
  decided_at: string | null;
  status: DecisionStatus;
  confidence: number;
  created_by: string;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

function rowToDecision(row: DbCharterDecisionRow): CharterDecision {
  return {
    id: row.id,
    linkedTable: row.linked_table,
    linkedId: row.linked_id,
    decisionType: row.decision_type,
    title: row.title,
    rationale: row.rationale,
    outcome: row.outcome,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at ? new Date(row.decided_at) : null,
    status: row.status,
    confidence: row.confidence,
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createCharterDecisionService(db: CharterDecisionDb): CharterDecisionService {
  return {
    async create(input) {
      if (input.confidence !== undefined) assertConfidence(input.confidence);
      const now = nowUtc().toISOString();
      const row = await db.insertDecision({
        id: crypto.randomUUID(),
        linked_table: input.linkedTable,
        linked_id: input.linkedId,
        decision_type: input.decisionType,
        title: input.title,
        rationale: input.rationale ?? null,
        outcome: input.outcome ?? {},
        decided_by: input.decidedBy ?? null,
        decided_at: input.decidedAt ?? null,
        status: input.status ?? 'pending',
        confidence: input.confidence ?? 50,
        created_by: input.createdBy,
        reviewed_by: null,
        created_at: now,
        updated_at: now,
      });
      return rowToDecision(row);
    },

    async getById(id) {
      const row = await db.findDecisionById(id);
      return row ? rowToDecision(row) : null;
    },

    async list(filter) {
      const rows = await db.queryDecisions(filter);
      return rows.map(rowToDecision);
    },

    async update(id, input) {
      if (input.confidence !== undefined) assertConfidence(input.confidence);
      const patch: Partial<DbCharterDecisionRow> = {
        updated_at: nowUtc().toISOString(),
      };
      if (input.decisionType !== undefined) patch.decision_type = input.decisionType;
      if (input.title !== undefined) patch.title = input.title;
      if (input.rationale !== undefined) patch.rationale = input.rationale;
      if (input.outcome !== undefined) patch.outcome = input.outcome;
      if (input.decidedBy !== undefined) patch.decided_by = input.decidedBy;
      if (input.decidedAt !== undefined) patch.decided_at = input.decidedAt;
      if (input.status !== undefined) patch.status = input.status;
      if (input.confidence !== undefined) patch.confidence = input.confidence;
      if (input.reviewedBy !== undefined) patch.reviewed_by = input.reviewedBy;

      const row = await db.updateDecision(id, patch);
      return rowToDecision(row);
    },
  };
}
