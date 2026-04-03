/**
 * Oracle profile-run service — manages Oracle analysis run lifecycle.
 *
 * An OracleProfileRun records one execution of the Oracle pipeline for
 * a given entity. Persisting runs enables cross-run diffing and audit trails.
 *
 * Lifecycle: queued → running → completed | failed | canceled
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  OracleProfileRun,
  CreateOracleProfileRunInput,
  CompleteOracleProfileRunInput,
  OracleProfileRunFilter,
} from '../../types/oracle/profile-run.js';
import { nowUtc } from '../../lib/provenance/clock.js';

export interface OracleProfileRunService {
  create(input: CreateOracleProfileRunInput): Promise<OracleProfileRun>;
  getById(id: string): Promise<OracleProfileRun | null>;
  /** Returns the most-recently-created run for the entity regardless of status. */
  getLatestForEntity(entityAssetId: string): Promise<OracleProfileRun | null>;
  list(filter?: OracleProfileRunFilter): Promise<OracleProfileRun[]>;
  /** Transition queued → running. */
  start(id: string): Promise<OracleProfileRun>;
  /** Transition running → completed with summary statistics. */
  complete(id: string, input: CompleteOracleProfileRunInput): Promise<OracleProfileRun>;
  /** Transition running → failed. */
  fail(id: string): Promise<OracleProfileRun>;
  /** Transition queued|running → canceled. */
  cancel(id: string): Promise<OracleProfileRun>;
}

export interface DbOracleProfileRunRow {
  id: string;
  entity_asset_id: string;
  status: string;
  triggered_by: string;
  started_at: string | null;
  completed_at: string | null;
  signal_count: number;
  top_score: number | null;
  summary: string | null;
  metadata: string;
  created_at: string;
}

export interface OracleProfileRunDb {
  insertRun(row: DbOracleProfileRunRow): Promise<DbOracleProfileRunRow>;
  findRunById(id: string): Promise<DbOracleProfileRunRow | null>;
  findLatestForEntity(entityAssetId: string): Promise<DbOracleProfileRunRow | null>;
  queryRuns(filter?: OracleProfileRunFilter): Promise<DbOracleProfileRunRow[]>;
  updateRun(id: string, patch: Partial<DbOracleProfileRunRow>): Promise<DbOracleProfileRunRow>;
}

function rowToRun(row: DbOracleProfileRunRow): OracleProfileRun {
  return {
    id: row.id,
    entityAssetId: row.entity_asset_id,
    status: row.status as OracleProfileRun['status'],
    triggeredBy: row.triggered_by,
    startedAt: row.started_at ? new Date(row.started_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    signalCount: row.signal_count,
    topScore: row.top_score,
    summary: row.summary,
    metadata: JSON.parse(row.metadata),
    createdAt: new Date(row.created_at),
  };
}

export function createOracleProfileRunService(db: OracleProfileRunDb): OracleProfileRunService {
  return {
    async create(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertRun({
        id: crypto.randomUUID(),
        entity_asset_id: input.entityAssetId,
        status: 'queued',
        triggered_by: input.triggeredBy,
        started_at: null,
        completed_at: null,
        signal_count: 0,
        top_score: null,
        summary: null,
        metadata: JSON.stringify(input.metadata ?? {}),
        created_at: now,
      });
      return rowToRun(row);
    },

    async getById(id) {
      const row = await db.findRunById(id);
      return row ? rowToRun(row) : null;
    },

    async getLatestForEntity(entityAssetId) {
      const row = await db.findLatestForEntity(entityAssetId);
      return row ? rowToRun(row) : null;
    },

    async list(filter) {
      const rows = await db.queryRuns(filter);
      return rows.map(rowToRun);
    },

    async start(id) {
      const row = await db.updateRun(id, {
        status: 'running',
        started_at: nowUtc().toISOString(),
      });
      return rowToRun(row);
    },

    async complete(id, input) {
      const row = await db.updateRun(id, {
        status: 'completed',
        completed_at: nowUtc().toISOString(),
        signal_count: input.signalCount,
        top_score: input.topScore,
        summary: input.summary ?? null,
      });
      return rowToRun(row);
    },

    async fail(id) {
      const row = await db.updateRun(id, {
        status: 'failed',
        completed_at: nowUtc().toISOString(),
      });
      return rowToRun(row);
    },

    async cancel(id) {
      const row = await db.updateRun(id, {
        status: 'canceled',
        completed_at: nowUtc().toISOString(),
      });
      return rowToRun(row);
    },
  };
}
