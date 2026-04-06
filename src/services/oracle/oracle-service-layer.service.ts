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
  OracleWhitespaceAnalysis,
} from '../../types/oracle/index.js';

export interface OracleServiceLayerService {
  executeWhitespaceRun(input: ExecuteOracleServiceLayerRunInput): Promise<OracleServiceLayerRun>;
  getRunById(id: string): Promise<OracleServiceLayerRun | null>;
}

export interface DbOracleServiceLayerRow {
  id: string;
  entity_asset_id: string;
  run_label: string;
  triggered_by: string;
  profile_run_id: string;
  whitespace_run_id: string | null;
  status: string;
  analysis_json: OracleWhitespaceAnalysis | null;
  error_message: string | null;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface OracleServiceLayerDb {
  insertRun(row: DbOracleServiceLayerRow): Promise<DbOracleServiceLayerRow>;
  findRunById(id: string): Promise<DbOracleServiceLayerRow | null>;
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

export function rowToEntity(row: DbOracleServiceLayerRow): OracleServiceLayerRun {
  return {
    id: row.id,
    entityAssetId: row.entity_asset_id,
    runLabel: row.run_label,
    triggeredBy: row.triggered_by,
    profileRunId: row.profile_run_id,
    whitespaceRunId: row.whitespace_run_id,
    status: row.status as OracleServiceLayerRun['status'],
    analysis: row.analysis_json,
    errorMessage: row.error_message,
    metadata: JSON.parse(row.metadata),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
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

      try {
        const analysis = deps.whitespaceCore.analyze(input.analysisInput);
        const whitespaceRun = await deps.whitespaceCore.createRun({
          entityAssetId: input.entityAssetId,
          runLabel: input.runLabel,
          analysis,
        });

        const topPredictiveGapScore = analysis.predictiveGaps.length
          ? Math.max(...analysis.predictiveGaps.map((x) => x.predictiveScore))
          : null;

        await deps.profileRun.complete(profileRun.id, {
          signalCount: analysis.predictiveGaps.length,
          topScore: topPredictiveGapScore,
          summary: `Whitespace run '${input.runLabel}' completed`,
        });

        const row = await db.insertRun({
          id: crypto.randomUUID(),
          entity_asset_id: input.entityAssetId,
          run_label: input.runLabel,
          triggered_by: input.triggeredBy,
          profile_run_id: profileRun.id,
          whitespace_run_id: whitespaceRun.id,
          status: 'completed',
          analysis_json: analysis,
          error_message: null,
          metadata: JSON.stringify(input.metadata ?? {}),
          created_at: now,
          updated_at: now,
        });

        return rowToEntity(row);
      } catch (error) {
        await deps.profileRun.fail(profileRun.id);

        const row = await db.insertRun({
          id: crypto.randomUUID(),
          entity_asset_id: input.entityAssetId,
          run_label: input.runLabel,
          triggered_by: input.triggeredBy,
          profile_run_id: profileRun.id,
          whitespace_run_id: null,
          status: 'failed',
          analysis_json: null,
          error_message: error instanceof Error ? error.message : String(error),
          metadata: JSON.stringify(input.metadata ?? {}),
          created_at: now,
          updated_at: now,
        });

        return rowToEntity(row);
      }
    },

    async getRunById(id) {
      const row = await db.findRunById(id);
      return row ? rowToEntity(row) : null;
    },
  };
}
