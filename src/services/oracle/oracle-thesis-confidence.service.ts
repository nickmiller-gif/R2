/**
 * Oracle Thesis Confidence service — orchestrates recalibration of thesis
 * confidence (slice O1 of the next-level roadmap).
 *
 * Reads the pure math from `src/lib/oracle/thesis-confidence-recalibration.ts`,
 * persists the new confidence on `oracle_theses`, and writes an audit row to
 * `oracle_thesis_confidence_history`. Idempotent per `(thesis, evidence_link)`
 * or `(thesis, outcome)` pair — re-runs of the outbox or pipeline don't
 * double-count.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 * No hook into existing flows is wired here — call sites land in a follow-up
 * slice once this primitive is in place.
 */

import { nowUtc } from '../../lib/provenance/clock.ts';
import { parseJsonbField } from './oracle-db-utils.ts';
import {
  RECALIBRATION_METHOD_BAYESIAN_V1,
  recalibrateForEvidence as computeEvidenceRecalibration,
  recalibrateForOutcome as computeOutcomeRecalibration,
  type RecalibrationOutcomeVerdict,
  type RecalibrationResult,
} from '../../lib/oracle/thesis-confidence-recalibration.ts';
import type {
  OracleThesisConfidenceHistoryEntry,
  RecalibrationSource,
} from '../../types/oracle/thesis-confidence-history.ts';
import type { OracleThesisEvidenceRole } from '../../types/oracle/shared.ts';

export interface RecalibrateForEvidenceInput {
  thesisId: string;
  /**
   * Evidence item the link points at. Paired with `role` this identifies the
   * specific `oracle_thesis_evidence_links` row, which has a composite PK and
   * no surrogate id.
   */
  evidenceItemId: string;
  role: OracleThesisEvidenceRole;
  /** Optional UUID of the operator / service that triggered the recalibration. */
  actor?: string | null;
  /** Free-form reason captured in the audit row. */
  reason?: string | null;
  /** Extra structured context persisted on the history row. */
  metadata?: Record<string, unknown>;
}

export interface RecalibrateForOutcomeInput {
  thesisId: string;
  outcomeId: string;
  actor?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RecalibrationOutcome {
  entry: OracleThesisConfidenceHistoryEntry;
  /** True when this call wrote a new history row; false when the (thesis, source) was already recorded. */
  recalibrated: boolean;
}

export interface OracleThesisConfidenceService {
  recalibrateForEvidence(input: RecalibrateForEvidenceInput): Promise<RecalibrationOutcome>;
  recalibrateForOutcome(input: RecalibrateForOutcomeInput): Promise<RecalibrationOutcome>;
  listHistory(thesisId: string): Promise<OracleThesisConfidenceHistoryEntry[]>;
}

export interface DbOracleThesisConfidenceHistoryRow {
  id: string;
  thesis_id: string;
  prior_confidence: number;
  new_confidence: number;
  delta: number;
  evidence_item_id: string | null;
  evidence_role: OracleThesisEvidenceRole | null;
  outcome_id: string | null;
  recalibration_method: string;
  log_odds_shift: number;
  reason: string | null;
  actor: string | null;
  metadata: string;
  created_at: string;
}

export interface DbOracleThesisLite {
  id: string;
  confidence: number;
}

export interface DbOracleThesisEvidenceLinkLite {
  thesis_id: string;
  evidence_item_id: string;
  role: OracleThesisEvidenceRole;
  weight: number;
}

export interface DbOracleEvidenceItemLite {
  id: string;
  confidence: number;
  evidence_strength: number;
}

export interface DbOracleOutcomeLite {
  id: string;
  thesis_id: string;
  verdict: RecalibrationOutcomeVerdict;
  accuracy_score: number | null;
}

export interface OracleThesisConfidenceDb {
  findThesisById(id: string): Promise<DbOracleThesisLite | null>;
  updateThesisConfidence(id: string, confidence: number, updatedAt: string): Promise<void>;
  findEvidenceLink(
    thesisId: string,
    evidenceItemId: string,
    role: OracleThesisEvidenceRole,
  ): Promise<DbOracleThesisEvidenceLinkLite | null>;
  findEvidenceItemById(id: string): Promise<DbOracleEvidenceItemLite | null>;
  findOutcomeById(id: string): Promise<DbOracleOutcomeLite | null>;
  insertHistory(
    row: DbOracleThesisConfidenceHistoryRow,
  ): Promise<DbOracleThesisConfidenceHistoryRow>;
  findHistoryByEvidence(
    thesisId: string,
    evidenceItemId: string,
    role: OracleThesisEvidenceRole,
  ): Promise<DbOracleThesisConfidenceHistoryRow | null>;
  findHistoryByOutcome(
    thesisId: string,
    outcomeId: string,
  ): Promise<DbOracleThesisConfidenceHistoryRow | null>;
  findHistoryByThesis(thesisId: string): Promise<DbOracleThesisConfidenceHistoryRow[]>;
}

function rowToEntry(row: DbOracleThesisConfidenceHistoryRow): OracleThesisConfidenceHistoryEntry {
  const source: RecalibrationSource = row.evidence_item_id !== null ? 'evidence_link' : 'outcome';
  return {
    id: row.id,
    thesisId: row.thesis_id,
    priorConfidence: Number(row.prior_confidence),
    newConfidence: Number(row.new_confidence),
    delta: Number(row.delta),
    source,
    evidenceItemId: row.evidence_item_id,
    evidenceRole: row.evidence_role,
    outcomeId: row.outcome_id,
    recalibrationMethod: row.recalibration_method,
    logOddsShift: Number(row.log_odds_shift),
    reason: row.reason,
    actor: row.actor,
    metadata: parseJsonbField(row.metadata),
    createdAt: new Date(row.created_at),
  };
}

export function createOracleThesisConfidenceService(
  db: OracleThesisConfidenceDb,
): OracleThesisConfidenceService {
  return {
    async recalibrateForEvidence(input) {
      const existing = await db.findHistoryByEvidence(
        input.thesisId,
        input.evidenceItemId,
        input.role,
      );
      if (existing) {
        return { entry: rowToEntry(existing), recalibrated: false };
      }

      const thesis = await db.findThesisById(input.thesisId);
      if (!thesis) {
        throw new Error(`OracleThesis not found: ${input.thesisId}`);
      }

      const link = await db.findEvidenceLink(input.thesisId, input.evidenceItemId, input.role);
      if (!link) {
        throw new Error(
          `OracleThesisEvidenceLink not found: (${input.thesisId}, ${input.evidenceItemId}, ${input.role})`,
        );
      }

      const evidence = await db.findEvidenceItemById(input.evidenceItemId);
      if (!evidence) {
        throw new Error(`OracleEvidenceItem not found: ${input.evidenceItemId}`);
      }

      const result = computeEvidenceRecalibration(thesis.confidence, {
        role: link.role,
        evidenceConfidence: evidence.confidence,
        evidenceStrength: evidence.evidence_strength,
        linkWeight: link.weight,
      });

      return persistRecalibration(db, {
        thesisId: input.thesisId,
        result,
        evidenceItemId: input.evidenceItemId,
        evidenceRole: input.role,
        outcomeId: null,
        actor: input.actor ?? null,
        reason: input.reason ?? null,
        metadata: input.metadata ?? {},
      });
    },

    async recalibrateForOutcome(input) {
      const existing = await db.findHistoryByOutcome(input.thesisId, input.outcomeId);
      if (existing) {
        return { entry: rowToEntry(existing), recalibrated: false };
      }

      const thesis = await db.findThesisById(input.thesisId);
      if (!thesis) {
        throw new Error(`OracleThesis not found: ${input.thesisId}`);
      }

      const outcome = await db.findOutcomeById(input.outcomeId);
      if (!outcome) {
        throw new Error(`OracleOutcome not found: ${input.outcomeId}`);
      }
      if (outcome.thesis_id !== input.thesisId) {
        throw new Error(
          `Outcome ${input.outcomeId} belongs to a different thesis (${outcome.thesis_id})`,
        );
      }

      const outcomeConfidence =
        outcome.accuracy_score != null && Number.isFinite(outcome.accuracy_score)
          ? Math.max(0, Math.min(1, outcome.accuracy_score / 100))
          : 1;

      const result = computeOutcomeRecalibration(thesis.confidence, {
        verdict: outcome.verdict,
        outcomeConfidence,
      });

      return persistRecalibration(db, {
        thesisId: input.thesisId,
        result,
        evidenceItemId: null,
        evidenceRole: null,
        outcomeId: input.outcomeId,
        actor: input.actor ?? null,
        reason: input.reason ?? null,
        metadata: input.metadata ?? {},
      });
    },

    async listHistory(thesisId) {
      const rows = await db.findHistoryByThesis(thesisId);
      return rows.map(rowToEntry);
    },
  };
}

interface PersistArgs {
  thesisId: string;
  result: RecalibrationResult;
  evidenceItemId: string | null;
  evidenceRole: OracleThesisEvidenceRole | null;
  outcomeId: string | null;
  actor: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
}

async function persistRecalibration(
  db: OracleThesisConfidenceDb,
  args: PersistArgs,
): Promise<RecalibrationOutcome> {
  const now = nowUtc().toISOString();

  if (args.result.delta !== 0) {
    await db.updateThesisConfidence(args.thesisId, args.result.newConfidence, now);
  }

  const inserted = await db.insertHistory({
    id: crypto.randomUUID(),
    thesis_id: args.thesisId,
    prior_confidence: args.result.priorConfidence,
    new_confidence: args.result.newConfidence,
    delta: args.result.delta,
    evidence_item_id: args.evidenceItemId,
    evidence_role: args.evidenceRole,
    outcome_id: args.outcomeId,
    recalibration_method: args.result.method ?? RECALIBRATION_METHOD_BAYESIAN_V1,
    log_odds_shift: args.result.logOddsShift,
    reason: args.reason,
    actor: args.actor,
    metadata: JSON.stringify(args.metadata),
    created_at: now,
  });

  return { entry: rowToEntry(inserted), recalibrated: true };
}
