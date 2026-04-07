import { nowUtc } from '../../lib/provenance/clock.js';
import type {
  OracleOperatorDecisionStatus,
  OracleServiceLayerRunDecision,
} from '../../types/oracle/service-layer.js';

export interface UpsertOracleServiceLayerRunDecisionInput {
  oracleServiceLayerRunId: string;
  decisionStatus: OracleOperatorDecisionStatus;
  notes?: string | null;
  decidedBy: string;
  decidedAt?: string;
}

export interface OracleServiceLayerRunDecisionService {
  upsertDecision(
    input: UpsertOracleServiceLayerRunDecisionInput,
  ): Promise<OracleServiceLayerRunDecision>;
  getDecisionByRunId(oracleServiceLayerRunId: string): Promise<OracleServiceLayerRunDecision | null>;
}

export interface DbOracleServiceLayerRunDecisionRow {
  id: string;
  oracle_service_layer_run_id: string;
  decision_status: OracleOperatorDecisionStatus;
  notes: string | null;
  decided_by: string;
  decided_at: string;
  created_at: string;
  updated_at: string;
}

export interface OracleServiceLayerRunDecisionDb {
  upsertDecision(row: DbOracleServiceLayerRunDecisionRow): Promise<DbOracleServiceLayerRunDecisionRow>;
  findDecisionByRunId(oracleServiceLayerRunId: string): Promise<DbOracleServiceLayerRunDecisionRow | null>;
}

function rowToEntity(row: DbOracleServiceLayerRunDecisionRow): OracleServiceLayerRunDecision {
  return {
    id: row.id,
    oracleServiceLayerRunId: row.oracle_service_layer_run_id,
    decisionStatus: row.decision_status,
    notes: row.notes,
    decidedBy: row.decided_by,
    decidedAt: new Date(row.decided_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createOracleServiceLayerRunDecisionService(
  db: OracleServiceLayerRunDecisionDb,
): OracleServiceLayerRunDecisionService {
  return {
    async upsertDecision(input) {
      const now = nowUtc().toISOString();
      const row = await db.upsertDecision({
        id: crypto.randomUUID(),
        oracle_service_layer_run_id: input.oracleServiceLayerRunId,
        decision_status: input.decisionStatus,
        notes: input.notes ?? null,
        decided_by: input.decidedBy,
        decided_at: input.decidedAt ?? now,
        created_at: now,
        updated_at: now,
      });
      return rowToEntity(row);
    },

    async getDecisionByRunId(oracleServiceLayerRunId) {
      const row = await db.findDecisionByRunId(oracleServiceLayerRunId);
      return row ? rowToEntity(row) : null;
    },
  };
}
