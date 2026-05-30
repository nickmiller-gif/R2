/**
 * Supabase-backed adapter for `OracleThesisConfidenceDb` — the storage port
 * consumed by `createOracleThesisConfidenceService` (slice O1).
 *
 * The service itself lives in `src/services/oracle/oracle-thesis-confidence
 * .service.ts` and is exercised by 25 unit tests against an in-memory stub.
 * This adapter is the production wiring: it speaks PostgREST against the
 * canonical schema so edge functions can call `recalibrateForEvidence` /
 * `recalibrateForOutcome` after their primary mutation succeeds.
 *
 * Fail-soft helpers (`recalibrateAfterEvidenceLink`,
 * `recalibrateAfterOutcome`) wrap the service call in a try/catch and log on
 * failure. Confidence reweighting is a derived signal — it must never block
 * the user-visible mutation that triggered it.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { logWarn } from './log.ts';
import {
  createOracleThesisConfidenceService,
  type DbOracleEvidenceItemLite,
  type DbOracleOutcomeLite,
  type DbOracleThesisConfidenceHistoryRow,
  type DbOracleThesisEvidenceLinkLite,
  type DbOracleThesisLite,
  type OracleThesisConfidenceDb,
  type RecalibrationOutcome,
} from '../../../src/services/oracle/oracle-thesis-confidence.service.ts';
import type { OracleThesisEvidenceRole } from '../../../src/types/oracle/shared.ts';
import type { RecalibrationOutcomeVerdict } from '../../../src/lib/oracle/thesis-confidence-recalibration.ts';

const HISTORY_TABLE = 'oracle_thesis_confidence_history';
const THESES_TABLE = 'oracle_theses';
const EVIDENCE_LINK_TABLE = 'oracle_thesis_evidence_links';
const EVIDENCE_ITEM_TABLE = 'oracle_evidence_items';
const OUTCOME_TABLE = 'oracle_outcomes';

const HISTORY_COLUMNS =
  'id, thesis_id, prior_confidence, new_confidence, delta, evidence_item_id, evidence_role, outcome_id, recalibration_method, log_odds_shift, reason, actor, metadata, created_at';

function historyRowFromPostgrest(row: Record<string, unknown>): DbOracleThesisConfidenceHistoryRow {
  return {
    id: row.id as string,
    thesis_id: row.thesis_id as string,
    prior_confidence: Number(row.prior_confidence),
    new_confidence: Number(row.new_confidence),
    delta: Number(row.delta),
    evidence_item_id: (row.evidence_item_id as string | null) ?? null,
    evidence_role: (row.evidence_role as OracleThesisEvidenceRole | null) ?? null,
    outcome_id: (row.outcome_id as string | null) ?? null,
    recalibration_method: row.recalibration_method as string,
    log_odds_shift: Number(row.log_odds_shift),
    reason: (row.reason as string | null) ?? null,
    actor: (row.actor as string | null) ?? null,
    // The service treats metadata as a JSON-encoded string (it parses via
    // parseJsonbField on read). Supabase returns jsonb as an already-parsed
    // object, so re-stringify here to keep the port contract stable.
    metadata: typeof row.metadata === 'string' ? row.metadata : JSON.stringify(row.metadata ?? {}),
    created_at: row.created_at as string,
  };
}

/**
 * Build the Supabase-backed `OracleThesisConfidenceDb`. Caller is responsible
 * for passing a service-role client — RLS on `oracle_thesis_confidence_history`
 * restricts INSERT to service_role.
 */
export function createOracleThesisConfidenceSupabaseDb(
  client: SupabaseClient,
): OracleThesisConfidenceDb {
  return {
    async findThesisById(id): Promise<DbOracleThesisLite | null> {
      const { data, error } = await client
        .from(THESES_TABLE)
        .select('id, confidence')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(`findThesisById(${id}): ${error.message}`);
      if (!data) return null;
      return { id: data.id as string, confidence: Number(data.confidence) };
    },

    async updateThesisConfidence(id, confidence, updatedAt) {
      const { error } = await client
        .from(THESES_TABLE)
        .update({ confidence, updated_at: updatedAt })
        .eq('id', id);
      if (error) throw new Error(`updateThesisConfidence(${id}): ${error.message}`);
    },

    async findEvidenceLink(
      thesisId,
      evidenceItemId,
      role,
    ): Promise<DbOracleThesisEvidenceLinkLite | null> {
      const { data, error } = await client
        .from(EVIDENCE_LINK_TABLE)
        .select('thesis_id, evidence_item_id, role, weight')
        .eq('thesis_id', thesisId)
        .eq('evidence_item_id', evidenceItemId)
        .eq('role', role)
        .maybeSingle();
      if (error) {
        throw new Error(
          `findEvidenceLink(${thesisId}, ${evidenceItemId}, ${role}): ${error.message}`,
        );
      }
      if (!data) return null;
      return {
        thesis_id: data.thesis_id as string,
        evidence_item_id: data.evidence_item_id as string,
        role: data.role as OracleThesisEvidenceRole,
        weight: Number(data.weight),
      };
    },

    async findEvidenceItemById(id): Promise<DbOracleEvidenceItemLite | null> {
      const { data, error } = await client
        .from(EVIDENCE_ITEM_TABLE)
        .select('id, confidence, evidence_strength')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(`findEvidenceItemById(${id}): ${error.message}`);
      if (!data) return null;
      return {
        id: data.id as string,
        confidence: Number(data.confidence),
        evidence_strength: Number(data.evidence_strength),
      };
    },

    async findOutcomeById(id): Promise<DbOracleOutcomeLite | null> {
      const { data, error } = await client
        .from(OUTCOME_TABLE)
        .select('id, thesis_id, verdict, accuracy_score')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(`findOutcomeById(${id}): ${error.message}`);
      if (!data) return null;
      return {
        id: data.id as string,
        thesis_id: data.thesis_id as string,
        verdict: data.verdict as RecalibrationOutcomeVerdict,
        accuracy_score: data.accuracy_score == null ? null : Number(data.accuracy_score),
      };
    },

    async insertHistory(row): Promise<DbOracleThesisConfidenceHistoryRow> {
      // Service hands us metadata as a JSON-encoded string; Supabase wants an
      // object for the jsonb column. Parse defensively — fall back to {} on
      // malformed input rather than failing the insert.
      let metadataObject: Record<string, unknown> = {};
      if (typeof row.metadata === 'string' && row.metadata.length > 0) {
        try {
          metadataObject = JSON.parse(row.metadata) as Record<string, unknown>;
        } catch {
          metadataObject = {};
        }
      }

      const { data, error } = await client
        .from(HISTORY_TABLE)
        .insert({
          id: row.id,
          thesis_id: row.thesis_id,
          prior_confidence: row.prior_confidence,
          new_confidence: row.new_confidence,
          delta: row.delta,
          evidence_item_id: row.evidence_item_id,
          evidence_role: row.evidence_role,
          outcome_id: row.outcome_id,
          recalibration_method: row.recalibration_method,
          log_odds_shift: row.log_odds_shift,
          reason: row.reason,
          actor: row.actor,
          metadata: metadataObject,
          created_at: row.created_at,
        })
        .select(HISTORY_COLUMNS)
        .single();
      if (error) throw new Error(`insertHistory: ${error.message}`);
      return historyRowFromPostgrest(data as Record<string, unknown>);
    },

    async findHistoryByEvidence(thesisId, evidenceItemId, role) {
      const { data, error } = await client
        .from(HISTORY_TABLE)
        .select(HISTORY_COLUMNS)
        .eq('thesis_id', thesisId)
        .eq('evidence_item_id', evidenceItemId)
        .eq('evidence_role', role)
        .maybeSingle();
      if (error) {
        throw new Error(
          `findHistoryByEvidence(${thesisId}, ${evidenceItemId}, ${role}): ${error.message}`,
        );
      }
      return data ? historyRowFromPostgrest(data as Record<string, unknown>) : null;
    },

    async findHistoryByOutcome(thesisId, outcomeId) {
      const { data, error } = await client
        .from(HISTORY_TABLE)
        .select(HISTORY_COLUMNS)
        .eq('thesis_id', thesisId)
        .eq('outcome_id', outcomeId)
        .maybeSingle();
      if (error) {
        throw new Error(`findHistoryByOutcome(${thesisId}, ${outcomeId}): ${error.message}`);
      }
      return data ? historyRowFromPostgrest(data as Record<string, unknown>) : null;
    },

    async findHistoryByThesis(thesisId) {
      const { data, error } = await client
        .from(HISTORY_TABLE)
        .select(HISTORY_COLUMNS)
        .eq('thesis_id', thesisId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`findHistoryByThesis(${thesisId}): ${error.message}`);
      return (data ?? []).map((row) => historyRowFromPostgrest(row as Record<string, unknown>));
    },
  };
}

export type RecalibrationCallSiteResult =
  | { ok: true; result: RecalibrationOutcome }
  | { ok: false; error: string };

export interface RecalibrateAfterEvidenceLinkParams {
  thesisId: string;
  evidenceItemId: string;
  role: OracleThesisEvidenceRole;
  actor?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-log helper for the edge function that creates evidence links.
 * Swallows errors — the link insert has already succeeded, and confidence
 * recalibration must never roll it back. Returns a tagged result so the
 * caller can record audit detail if it wants.
 */
export async function recalibrateAfterEvidenceLink(
  client: SupabaseClient,
  params: RecalibrateAfterEvidenceLinkParams,
): Promise<RecalibrationCallSiteResult> {
  try {
    const svc = createOracleThesisConfidenceService(createOracleThesisConfidenceSupabaseDb(client));
    const result = await svc.recalibrateForEvidence({
      thesisId: params.thesisId,
      evidenceItemId: params.evidenceItemId,
      role: params.role,
      actor: params.actor ?? null,
      reason: params.reason ?? 'evidence_link_created',
      metadata: params.metadata ?? {},
    });
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logWarn('oracle-thesis-confidence recalibrateAfterEvidenceLink failed (fail-open)', {
      functionName: 'oracle-thesis-confidence',
      thesisId: params.thesisId,
      evidenceItemId: params.evidenceItemId,
      role: params.role,
      error: message,
    });
    return { ok: false, error: message };
  }
}

export interface RecalibrateAfterOutcomeParams {
  thesisId: string;
  outcomeId: string;
  actor?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-log helper for the edge function that records outcomes.
 * Same fail-soft contract as `recalibrateAfterEvidenceLink`.
 */
export async function recalibrateAfterOutcome(
  client: SupabaseClient,
  params: RecalibrateAfterOutcomeParams,
): Promise<RecalibrationCallSiteResult> {
  try {
    const svc = createOracleThesisConfidenceService(createOracleThesisConfidenceSupabaseDb(client));
    const result = await svc.recalibrateForOutcome({
      thesisId: params.thesisId,
      outcomeId: params.outcomeId,
      actor: params.actor ?? null,
      reason: params.reason ?? 'outcome_recorded',
      metadata: params.metadata ?? {},
    });
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logWarn('oracle-thesis-confidence recalibrateAfterOutcome failed (fail-open)', {
      functionName: 'oracle-thesis-confidence',
      thesisId: params.thesisId,
      outcomeId: params.outcomeId,
      error: message,
    });
    return { ok: false, error: message };
  }
}
