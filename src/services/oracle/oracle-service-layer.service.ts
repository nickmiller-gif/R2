/**
 * Oracle service-layer orchestrator.
 *
 * Sits above whitespace-core primitives and formalizes a stable backend-facing
 * contract for running Oracle whitespace analysis as one domain operation.
 */

import { nowUtc } from '../../lib/provenance/clock.js';
import type {
  ExecuteOracleServiceLayerRunInput,
  OracleServiceLayerRun,
  OracleServiceLayerRunHistoryFilter,
  OracleServiceLayerRunSummaryRow,
  OracleServiceLayerRunStatus,
  OracleWhitespaceAnalysis,
} from '../../types/oracle/index.js';
import type { OracleWhitespaceRunSummary } from '../../types/oracle/whitespace-core.js';

export const ORACLE_SERVICE_LAYER_HISTORY_LIMIT_DEFAULT = 20;
export const ORACLE_SERVICE_LAYER_HISTORY_LIMIT_MAX = 100;

export interface OracleServiceLayerService {
  executeWhitespaceRun(input: ExecuteOracleServiceLayerRunInput): Promise<OracleServiceLayerRun>;
  getRunById(id: string): Promise<OracleServiceLayerRun | null>;
  listRecentRuns(filter?: OracleServiceLayerRunHistoryFilter): Promise<OracleServiceLayerRunSummaryRow[]>;
}

export interface DbOracleServiceLayerRow {
  id: string;
  entity_asset_id: string;
  run_label: string;
  triggered_by: string;
  profile_run_id: string;
  whitespace_run_id: string | null;
  status: string;
  analysis_json: string | null;
  error_message: string | null;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface OracleServiceLayerDb {
  insertRun(row: DbOracleServiceLayerRow): Promise<DbOracleServiceLayerRow>;
  findRunById(id: string): Promise<DbOracleServiceLayerRow | null>;
  queryRuns(filter?: OracleServiceLayerRunHistoryFilter): Promise<DbOracleServiceLayerRow[]>;
  updateRun(id: string, patch: Partial<DbOracleServiceLayerRow>): Promise<DbOracleServiceLayerRow>;
}

export interface OracleServiceLayerDeps {
  whitespaceCore: {
    analyze(input: ExecuteOracleServiceLayerRunInput['analysisInput']): OracleWhitespaceAnalysis;
    createRun(input: {
      entityAssetId: string;
      runLabel: string;
      analysis: OracleWhitespaceAnalysis;
    }): Promise<{ id: string }>;
  };
  profileRun: {
    create(input: { entityAssetId: string; triggeredBy: string; metadata?: Record<string, unknown> }): Promise<{
      id: string;
    }>;
    start(id: string): Promise<unknown>;
    complete(
      id: string,
      input: { signalCount: number; topScore: number | null; summary?: string },
    ): Promise<unknown>;
    fail(id: string): Promise<unknown>;
  };
}

function rowToEntity(row: DbOracleServiceLayerRow): OracleServiceLayerRun {
  return {
    id: row.id,
    entityAssetId: row.entity_asset_id,
    runLabel: row.run_label,
    triggeredBy: row.triggered_by,
    profileRunId: row.profile_run_id,
    whitespaceRunId: row.whitespace_run_id,
    status: row.status as OracleServiceLayerRun['status'],
    analysis: row.analysis_json ? (JSON.parse(row.analysis_json) as OracleWhitespaceAnalysis) : null,
    errorMessage: row.error_message,
    metadata: JSON.parse(row.metadata),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Lightweight mapper for history list responses.
 * Parses only the `summary` field from `analysis_json` — avoids deserializing
 * the full analysis payload and skips `metadata` entirely.
 */
function rowToHistoryRow(row: DbOracleServiceLayerRow): OracleServiceLayerRunSummaryRow {
  let summary: OracleWhitespaceRunSummary | null = null;
  if (row.analysis_json) {
    try {
      const parsed = JSON.parse(row.analysis_json) as { summary?: OracleWhitespaceRunSummary };
      summary = parsed.summary ?? null;
    } catch {
      // ignore malformed JSON — summary stays null
    }
  }
  return {
    id: row.id,
    entityAssetId: row.entity_asset_id,
    runLabel: row.run_label,
    status: row.status as OracleServiceLayerRunStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    summary,
  };
}

export function createOracleServiceLayerService(
  db: OracleServiceLayerDb,
  deps: OracleServiceLayerDeps,
): OracleServiceLayerService {
  return {
    async executeWhitespaceRun(input) {
      const now = nowUtc().toISOString();
      const profileRun = await deps.profileRun.create({
        entityAssetId: input.entityAssetId,
        triggeredBy: input.triggeredBy,
        metadata: input.metadata,
      });

      await deps.profileRun.start(profileRun.id);

      const runId = crypto.randomUUID();

      try {
        // Persist an initial 'running' record so in-flight runs are visible
        // and recoverable on crash before analysis completes.
        await db.insertRun({
          id: runId,
          entity_asset_id: input.entityAssetId,
          run_label: input.runLabel,
          triggered_by: input.triggeredBy,
          profile_run_id: profileRun.id,
          whitespace_run_id: null,
          status: 'running',
          analysis_json: null,
          error_message: null,
          metadata: JSON.stringify(input.metadata ?? {}),
          created_at: now,
          updated_at: now,
        });

        const analysis = deps.whitespaceCore.analyze(input.analysisInput);
        const whitespaceRun = await deps.whitespaceCore.createRun({
          entityAssetId: input.entityAssetId,
          runLabel: input.runLabel,
          analysis,
        });

        const topPredictiveGapScore = analysis.predictiveGaps.length
          ? Math.max(...analysis.predictiveGaps.map((x) => x.predictiveScore))
          : null;

        const updatedNow = nowUtc().toISOString();

        // Persist completion before transitioning profile-run so the service-layer
        // record is never marked completed without a persisted result.
        const completedRow = await db.updateRun(runId, {
          status: 'completed',
          analysis_json: JSON.stringify(analysis),
          whitespace_run_id: whitespaceRun.id,
          updated_at: updatedNow,
        });

        // Best-effort profile-run completion — the run is already persisted.
        try {
          await deps.profileRun.complete(profileRun.id, {
            signalCount: analysis.predictiveGaps.length,
            topScore: topPredictiveGapScore,
            summary: `Whitespace run '${input.runLabel}' completed`,
          });
        } catch {
          // swallow — run record is already persisted as 'completed'
        }

        return rowToEntity(completedRow);
      } catch (error) {
        const originalMessage = error instanceof Error ? error.message : String(error);

        // Best-effort: transition profile-run to failed.
        // Errors here are swallowed so the original error context is preserved.
        try {
          await deps.profileRun.fail(profileRun.id);
        } catch {
          // swallow — preserve original error
        }

        // Best-effort: update run record to 'failed'.
        // If this also fails, re-throw the original error.
        try {
          const failedRow = await db.updateRun(runId, {
            status: 'failed',
            error_message: originalMessage,
            updated_at: nowUtc().toISOString(),
          });
          return rowToEntity(failedRow);
        } catch {
          throw error;
        }
      }
    },

    async getRunById(id) {
      const row = await db.findRunById(id);
      return row ? rowToEntity(row) : null;
    },

    async listRecentRuns(filter) {
      const limit = filter?.limit ?? ORACLE_SERVICE_LAYER_HISTORY_LIMIT_DEFAULT;
      if (!Number.isInteger(limit) || limit < 1 || limit > ORACLE_SERVICE_LAYER_HISTORY_LIMIT_MAX) {
        throw new Error(
          `limit must be a positive integer between 1 and ${ORACLE_SERVICE_LAYER_HISTORY_LIMIT_MAX}`,
        );
      }
      const rows = await db.queryRuns({ ...filter, limit });
      return rows.map(rowToHistoryRow);
    },
  };
}
