/**
 * Retrieval Run Service — telemetry for retrieval operations.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  RetrievalRun,
  CreateRetrievalRunInput,
  RetrievalRunFilter,
} from '../../types/eigen/retrieval-run.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import { parseJsonbField, parseJsonbArray } from '../oracle/oracle-db-utils.js';

export interface RetrievalRunService {
  create(input: CreateRetrievalRunInput): Promise<RetrievalRun>;
  getById(id: string): Promise<RetrievalRun | null>;
  list(filter?: RetrievalRunFilter): Promise<RetrievalRun[]>;
  complete(id: string, results: {
    candidateCount: number;
    filteredCount: number;
    finalCount: number;
    latencyMs: number;
  }): Promise<RetrievalRun>;
  fail(id: string, reason: string): Promise<RetrievalRun>;
}

export interface DbRetrievalRunRow {
  id: string;
  query_hash: string;
  decomposition: string;
  candidate_count: number;
  filtered_count: number;
  final_count: number;
  budget_profile: string;
  dropped_context_reasons: string;
  latency_ms: number;
  status: string;
  metadata: string;
  created_at: string;
}

export interface RetrievalRunDb {
  insertRun(row: DbRetrievalRunRow): Promise<DbRetrievalRunRow>;
  findRunById(id: string): Promise<DbRetrievalRunRow | null>;
  queryRuns(filter?: RetrievalRunFilter): Promise<DbRetrievalRunRow[]>;
  updateRun(id: string, patch: Partial<DbRetrievalRunRow>): Promise<DbRetrievalRunRow>;
}

function rowToRun(row: DbRetrievalRunRow): RetrievalRun {
  return {
    id: row.id,
    queryHash: row.query_hash,
    decomposition: parseJsonbField(row.decomposition),
    candidateCount: row.candidate_count,
    filteredCount: row.filtered_count,
    finalCount: row.final_count,
    budgetProfile: parseJsonbField(row.budget_profile),
    droppedContextReasons: parseJsonbArray(row.dropped_context_reasons) as string[],
    latencyMs: row.latency_ms,
    status: row.status as RetrievalRun['status'],
    metadata: parseJsonbField(row.metadata),
    createdAt: new Date(row.created_at),
  };
}

export function createRetrievalRunService(db: RetrievalRunDb): RetrievalRunService {
  return {
    async create(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertRun({
        id: crypto.randomUUID(),
        query_hash: input.queryHash,
        decomposition: JSON.stringify(input.decomposition ?? {}),
        candidate_count: 0,
        filtered_count: 0,
        final_count: 0,
        budget_profile: JSON.stringify(input.budgetProfile ?? {}),
        dropped_context_reasons: JSON.stringify([]),
        latency_ms: 0,
        status: 'pending',
        metadata: JSON.stringify({}),
        created_at: now,
      });
      return rowToRun(row);
    },

    async getById(id) {
      const row = await db.findRunById(id);
      return row ? rowToRun(row) : null;
    },

    async list(filter) {
      const rows = await db.queryRuns(filter);
      return rows.map(rowToRun);
    },

    async complete(id, results) {
      const row = await db.updateRun(id, {
        status: 'completed',
        candidate_count: results.candidateCount,
        filtered_count: results.filteredCount,
        final_count: results.finalCount,
        latency_ms: results.latencyMs,
      });
      return rowToRun(row);
    },

    async fail(id, reason) {
      const row = await db.updateRun(id, {
        status: 'failed',
        metadata: JSON.stringify({ failureReason: reason }),
      });
      return rowToRun(row);
    },
  };
}
