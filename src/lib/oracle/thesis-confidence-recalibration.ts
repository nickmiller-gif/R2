/**
 * Oracle thesis confidence recalibration (slice O1 of the next-level roadmap).
 *
 * Pure math for moving a thesis's confidence score when new evidence is linked
 * or when an outcome is recorded. No DB access — the service layer wraps these
 * helpers and persists results.
 *
 * Formula version: `bayesian-v1`. Operates in log-odds space so updates are
 * smooth, bounded, and direction-monotonic.
 *
 *   - Confidence is stored in [0, 100]. Internally we clamp to [1, 99] before
 *     taking the logit to avoid infinities.
 *   - Each evidence update shifts the log-odds by a signed quantity derived
 *     from `(role, evidenceConfidence, evidenceStrength, linkWeight)`.
 *   - Each outcome update shifts the log-odds by a verdict-specific constant.
 *
 * Versioning the method via the `recalibration_method` column on the history
 * table lets us A/B alternate formulas without rewriting historic rows.
 */

import type { OracleThesisEvidenceRole } from '../../types/oracle/shared.ts';

export const RECALIBRATION_METHOD_BAYESIAN_V1 = 'bayesian-v1';

/**
 * Verdict values produced by the outcome service.
 * Mirrors `OutcomeVerdict` in `src/types/oracle/outcome.ts`; redeclared here
 * to keep this module dependency-free of the wider Oracle type tree.
 */
export type RecalibrationOutcomeVerdict =
  | 'confirmed'
  | 'partially_confirmed'
  | 'refuted'
  | 'inconclusive'
  | 'pending';

export interface RecalibrationEvidenceInput {
  role: OracleThesisEvidenceRole;
  /** Evidence item's own confidence, 0–100. */
  evidenceConfidence: number;
  /** Evidence item's strength score, 0–100. Treated as a secondary weight. */
  evidenceStrength: number;
  /** Link weight from `oracle_thesis_evidence_links.weight` (default 1.0). */
  linkWeight: number;
}

export interface RecalibrationOutcomeInput {
  verdict: RecalibrationOutcomeVerdict;
  /**
   * Optional confidence in the outcome itself (0–1). Defaults to 1 — operators
   * recording outcomes are assumed to be authoritative unless they say
   * otherwise.
   */
  outcomeConfidence?: number;
}

export interface RecalibrationResult {
  priorConfidence: number;
  newConfidence: number;
  delta: number;
  logOddsShift: number;
  method: typeof RECALIBRATION_METHOD_BAYESIAN_V1;
}

const CONFIDENCE_MIN = 1;
const CONFIDENCE_MAX = 99;

/**
 * Maximum magnitude of a single evidence-driven shift in log-odds space. With
 * a shift of 2.0, the odds change by a factor of e^2 ≈ 7.4 per update — strong
 * enough that high-quality evidence moves the needle, bounded enough that a
 * spam of low-quality evidence can't pin confidence at the extremes.
 */
const MAX_EVIDENCE_LOG_ODDS_SHIFT = 2.0;

const VERDICT_LOG_ODDS_SHIFT: Record<RecalibrationOutcomeVerdict, number> = {
  confirmed: 2.0,
  partially_confirmed: 0.6,
  inconclusive: 0,
  refuted: -2.0,
  pending: 0,
};

/**
 * Bayesian-style update: new evidence shifts the thesis's log-odds.
 *
 *   - `validation` → positive shift (raises confidence)
 *   - `contradiction` → negative shift (lowers confidence)
 *   - `inspiration` → zero shift (inspiration is provenance only, not support)
 *
 * The magnitude of the shift scales with the evidence's own confidence, its
 * evidence strength, and the link weight from the thesis-evidence-link row.
 */
export function recalibrateForEvidence(
  priorConfidence: number,
  evidence: RecalibrationEvidenceInput,
): RecalibrationResult {
  const sign = roleSign(evidence.role);
  if (sign === 0) {
    return zeroShiftResult(priorConfidence);
  }

  const evidenceFactor = clamp01(evidence.evidenceConfidence / 100);
  const strengthFactor = clamp01(evidence.evidenceStrength / 100);
  const weightFactor = clampPositive(evidence.linkWeight, 1.0);

  const magnitude = MAX_EVIDENCE_LOG_ODDS_SHIFT * evidenceFactor * strengthFactor * weightFactor;
  const logOddsShift = sign * magnitude;

  return applyLogOddsShift(priorConfidence, logOddsShift);
}

/**
 * Outcome-driven update. Verdicts shift log-odds by a fixed magnitude that
 * scales with the operator-supplied `outcomeConfidence` (default 1.0).
 */
export function recalibrateForOutcome(
  priorConfidence: number,
  outcome: RecalibrationOutcomeInput,
): RecalibrationResult {
  const baseShift = VERDICT_LOG_ODDS_SHIFT[outcome.verdict];
  if (baseShift === 0) return zeroShiftResult(priorConfidence);

  const confidenceFactor = clamp01(outcome.outcomeConfidence ?? 1);
  return applyLogOddsShift(priorConfidence, baseShift * confidenceFactor);
}

function applyLogOddsShift(priorConfidence: number, logOddsShift: number): RecalibrationResult {
  const clampedPrior = clampToConfidenceRange(priorConfidence);
  const priorLogOdds = Math.log(clampedPrior / (100 - clampedPrior));
  const newLogOdds = priorLogOdds + logOddsShift;
  const newConfidence = 100 / (1 + Math.exp(-newLogOdds));
  const rounded = roundConfidence(newConfidence);
  return {
    priorConfidence,
    newConfidence: rounded,
    delta: roundConfidence(rounded - priorConfidence),
    logOddsShift,
    method: RECALIBRATION_METHOD_BAYESIAN_V1,
  };
}

function zeroShiftResult(priorConfidence: number): RecalibrationResult {
  return {
    priorConfidence,
    newConfidence: priorConfidence,
    delta: 0,
    logOddsShift: 0,
    method: RECALIBRATION_METHOD_BAYESIAN_V1,
  };
}

function roleSign(role: OracleThesisEvidenceRole): -1 | 0 | 1 {
  if (role === 'validation') return 1;
  if (role === 'contradiction') return -1;
  return 0;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampPositive(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function clampToConfidenceRange(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(CONFIDENCE_MIN, Math.min(CONFIDENCE_MAX, value));
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}
