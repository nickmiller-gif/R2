/**
 * Oracle Service-Layer Run Outcome service.
 *
 * Records what actually happened after an operator decision on a whitespace run
 * (pursued → won/lost, deferred, dismissed). One outcome record per run.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import { nowUtc } from '../../lib/provenance/clock.js';
import type {
  OracleServiceLayerRunOutcome,
  CreateOracleServiceLayerRunOutcomeInput,
  UpdateOracleServiceLayerRunOutcomeInput,
  OracleServiceLayerRunOutcomeFilter,
  OracleRunOutcomeStatus,
} from '../../types/oracle/run-outcome.js';

export interface OracleServiceLayerRunOutcomeService {
  upsertOutcome(
    input: CreateOracleServiceLayerRunOutcomeInput,
  ): Promise<OracleServiceLayerRunOutcome>;
  getOutcomeByRunId(
    oracleServiceLayerRunId: string,
  ): Promise<OracleServiceLayerRunOutcome | null>;
  getOutcomesByRunIds(runIds: string[]): Promise<Map<string, OracleServiceLayerRunOutcome>>;
  updateOutcome(
    id: string,
    input: UpdateOracleServiceLayerRunOutcomeInput,
  ): Promise<OracleServiceLayerRunOutcome>;
  listOutcomes(
    filter?: OracleServiceLayerRunOutcomeFilter,
  ): Promise<OracleServiceLayerRunOutcome[]>;
}

export interface DbOracleServiceLayerRunOutcomeRow {
  id: string;
  oracle_service_layer_run_id: string;
  outcome_status: OracleRunOutcomeStatus;
  outcome_notes: string | null;
  outcome_revenue: number | null;
  outcome_closed_at: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export interface OracleServiceLayerRunOutcomeDb {
  upsertOutcome(
    row: DbOracleServiceLayerRunOutcomeRow,
  ): Promise<DbOracleServiceLayerRunOutcomeRow>;
  findOutcomeByRunId(
    oracleServiceLayerRunId: string,
  ): Promise<DbOracleServiceLayerRunOutcomeRow | null>;
  findOutcomeById(id: string): Promise<DbOracleServiceLayerRunOutcomeRow | null>;
  findOutcomesByRunIds(runIds: string[]): Promise<DbOracleServiceLayerRunOutcomeRow[]>;
  queryOutcomes(
    filter?: OracleServiceLayerRunOutcomeFilter,
  ): Promise<DbOracleServiceLayerRunOutcomeRow[]>;
  updateOutcome(
    id: string,
    patch: Partial<DbOracleServiceLayerRunOutcomeRow>,
  ): Promise<DbOracleServiceLayerRunOutcomeRow>;
}

function rowToEntity(row: DbOracleServiceLayerRunOutcomeRow): OracleServiceLayerRunOutcome {
  return {
    id: row.id,
    oracleServiceLayerRunId: row.oracle_service_layer_run_id,
    outcomeStatus: row.outcome_status,
    outcomeNotes: row.outcome_notes,
    outcomeRevenue: row.outcome_revenue,
    outcomeClosedAt: row.outcome_closed_at ? new Date(row.outcome_closed_at) : null,
    recordedBy: row.recorded_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function assertValidOutcomeRevenue(outcomeRevenue: number | null | undefined): void {
  if (outcomeRevenue !== null && outcomeRevenue !== undefined && outcomeRevenue < 0) {
    throw new Error('Outcome revenue cannot be negative.');
  }
}

function assertValidOutcomeClosedAt(outcomeClosedAt: string | null | undefined): void {
  if (outcomeClosedAt === null || outcomeClosedAt === undefined) return;
  const parsed = new Date(outcomeClosedAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Outcome closed timestamp must be a valid ISO-8601 datetime.');
  }
}

export function createOracleServiceLayerRunOutcomeService(
  db: OracleServiceLayerRunOutcomeDb,
): OracleServiceLayerRunOutcomeService {
  return {
    async upsertOutcome(input) {
      assertValidOutcomeRevenue(input.outcomeRevenue);
      assertValidOutcomeClosedAt(input.outcomeClosedAt);

      const now = nowUtc().toISOString();
      const existing = await db.findOutcomeByRunId(input.oracleServiceLayerRunId);
      const row = await db.upsertOutcome({
        id: existing?.id ?? crypto.randomUUID(),
        oracle_service_layer_run_id: input.oracleServiceLayerRunId,
        outcome_status: input.outcomeStatus,
        outcome_notes: input.outcomeNotes ?? null,
        outcome_revenue: input.outcomeRevenue ?? null,
        outcome_closed_at: input.outcomeClosedAt ?? null,
        recorded_by: input.recordedBy,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      });
      return rowToEntity(row);
    },

    async getOutcomeByRunId(oracleServiceLayerRunId) {
      const row = await db.findOutcomeByRunId(oracleServiceLayerRunId);
      return row ? rowToEntity(row) : null;
    },

    async getOutcomesByRunIds(runIds) {
      if (runIds.length === 0) return new Map();
      const rows = await db.findOutcomesByRunIds(runIds);
      const map = new Map<string, OracleServiceLayerRunOutcome>();
      for (const row of rows) {
        map.set(row.oracle_service_layer_run_id, rowToEntity(row));
      }
      return map;
    },

    async updateOutcome(id, input) {
      assertValidOutcomeRevenue(input.outcomeRevenue);
      assertValidOutcomeClosedAt(input.outcomeClosedAt);

      const now = nowUtc().toISOString();
      const patch: Partial<DbOracleServiceLayerRunOutcomeRow> = { updated_at: now };
      if (input.outcomeStatus !== undefined) patch.outcome_status = input.outcomeStatus;
      if (input.outcomeNotes !== undefined) patch.outcome_notes = input.outcomeNotes;
      if (input.outcomeRevenue !== undefined) patch.outcome_revenue = input.outcomeRevenue;
      if (input.outcomeClosedAt !== undefined) patch.outcome_closed_at = input.outcomeClosedAt;
      const row = await db.updateOutcome(id, patch);
      return rowToEntity(row);
    },

    async listOutcomes(filter) {
      const rows = await db.queryOutcomes(filter);
      return rows.map(rowToEntity);
    },
  };
}
