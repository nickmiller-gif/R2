/**
 * Oracle Outcome service — tracks real-world results against thesis predictions.
 *
 * Outcomes close the intelligence feedback loop. When a thesis predicts an
 * outcome, this service records what actually happened and computes accuracy
 * and confidence adjustments.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  OracleOutcome,
  CreateOracleOutcomeInput,
  UpdateOracleOutcomeInput,
  OracleOutcomeFilter,
} from '../../types/oracle/outcome.ts';
import { nowUtc } from '../../lib/provenance/clock.ts';
import { parseJsonbField, parseJsonbArray } from './oracle-db-utils.ts';

export interface OracleOutcomeService {
  create(input: CreateOracleOutcomeInput): Promise<OracleOutcome>;
  getById(id: string): Promise<OracleOutcome | null>;
  list(filter?: OracleOutcomeFilter): Promise<OracleOutcome[]>;
  update(id: string, input: UpdateOracleOutcomeInput): Promise<OracleOutcome>;
  listByThesis(thesisId: string): Promise<OracleOutcome[]>;
}

export interface DbOracleOutcomeRow {
  id: string;
  thesis_id: string;
  profile_id: string | null;
  verdict: string;
  outcome_source: string;
  observed_at: string;
  summary: string;
  evidence_refs: string;
  accuracy_score: number | null;
  confidence_delta: number | null;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface OracleOutcomeDb {
  insertOutcome(row: DbOracleOutcomeRow): Promise<DbOracleOutcomeRow>;
  findOutcomeById(id: string): Promise<DbOracleOutcomeRow | null>;
  queryOutcomes(filter?: OracleOutcomeFilter): Promise<DbOracleOutcomeRow[]>;
  updateOutcome(id: string, patch: Partial<DbOracleOutcomeRow>): Promise<DbOracleOutcomeRow>;
}

function rowToOutcome(row: DbOracleOutcomeRow): OracleOutcome {
  return {
    id: row.id,
    thesisId: row.thesis_id,
    profileId: row.profile_id,
    verdict: row.verdict as OracleOutcome['verdict'],
    outcomeSource: row.outcome_source as OracleOutcome['outcomeSource'],
    observedAt: new Date(row.observed_at),
    summary: row.summary,
    evidenceRefs: parseJsonbArray(row.evidence_refs) as string[],
    accuracyScore: row.accuracy_score,
    confidenceDelta: row.confidence_delta,
    metadata: parseJsonbField(row.metadata),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createOracleOutcomeService(db: OracleOutcomeDb): OracleOutcomeService {
  return {
    async create(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertOutcome({
        id: crypto.randomUUID(),
        thesis_id: input.thesisId,
        profile_id: input.profileId ?? null,
        verdict: input.verdict,
        outcome_source: input.outcomeSource ?? 'manual',
        observed_at: input.observedAt ?? now,
        summary: input.summary,
        evidence_refs: JSON.stringify(input.evidenceRefs ?? []),
        accuracy_score: input.accuracyScore ?? null,
        confidence_delta: input.confidenceDelta ?? null,
        metadata: JSON.stringify(input.metadata ?? {}),
        created_at: now,
        updated_at: now,
      });
      return rowToOutcome(row);
    },

    async getById(id) {
      const row = await db.findOutcomeById(id);
      return row ? rowToOutcome(row) : null;
    },

    async list(filter) {
      const rows = await db.queryOutcomes(filter);
      return rows.map(rowToOutcome);
    },

    async update(id, input) {
      const now = nowUtc().toISOString();
      const patch: Partial<DbOracleOutcomeRow> = { updated_at: now };
      if (input.verdict !== undefined) patch.verdict = input.verdict;
      if (input.summary !== undefined) patch.summary = input.summary;
      if (input.accuracyScore !== undefined) patch.accuracy_score = input.accuracyScore;
      if (input.confidenceDelta !== undefined) patch.confidence_delta = input.confidenceDelta;
      if (input.evidenceRefs !== undefined) patch.evidence_refs = JSON.stringify(input.evidenceRefs);
      if (input.metadata !== undefined) patch.metadata = JSON.stringify(input.metadata);

      const row = await db.updateOutcome(id, patch);
      return rowToOutcome(row);
    },

    async listByThesis(thesisId) {
      const rows = await db.queryOutcomes({ thesisId });
      return rows.map(rowToOutcome);
    },
  };
}
