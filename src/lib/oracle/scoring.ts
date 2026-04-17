/**
 * Oracle scoring primitives — reweighting execution core.
 *
 * Pure computation helpers for score recalibration, confidence band mapping,
 * and weighted evidence aggregation. No DB access.
 *
 * Maps to `oracleReweightingExecutionCore` in the legacy shared/oracle layer.
 */

import type { ConfidenceBand } from '../../types/oracle/signal.ts';

/**
 * Clamp a raw numeric score to the [0, 100] range.
 */
export function clampScore(score: number): number {
  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * Apply a weighted evidence adjustment to a base score.
 *
 * @param baseScore   Starting score (0–100).
 * @param adjustment  Delta to apply (positive = boost, negative = penalise).
 * @param weight      Evidence weight (0–1); scales the adjustment magnitude.
 * @returns           Recalibrated score clamped to [0, 100].
 */
export function reweightScore(baseScore: number, adjustment: number, weight: number): number {
  const w = Math.min(1, Math.max(0, weight));
  return clampScore(baseScore + w * adjustment);
}

/**
 * Map a 0–100 numeric score to a ConfidenceBand.
 *
 * - high   : score ≥ 70
 * - medium : score ≥ 40
 * - low    : score < 40
 */
export function scoreToConfidenceBand(score: number): ConfidenceBand {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export interface WeightedScore {
  score: number;
  weight: number;
}

/**
 * Compute the weighted average of multiple scored items.
 * Returns 0 when the input is empty or all weights are zero.
 */
export function aggregateScores(items: ReadonlyArray<WeightedScore>): number {
  if (items.length === 0) return 0;
  const totalWeight = items.reduce((s, x) => s + x.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = items.reduce((s, x) => s + x.score * x.weight, 0);
  return clampScore(weighted / totalWeight);
}

/**
 * Blend a new evidence score into an existing score.
 *
 * @param currentScore    Current signal score (0–100).
 * @param evidenceScore   New evidence score (0–100).
 * @param blendFactor     0–1; how much the new evidence shifts the score.
 * @returns               Updated score clamped to [0, 100].
 */
export function blendEvidenceScore(
  currentScore: number,
  evidenceScore: number,
  blendFactor: number,
): number {
  const f = Math.min(1, Math.max(0, blendFactor));
  return clampScore(currentScore * (1 - f) + evidenceScore * f);
}
