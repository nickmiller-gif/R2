/**
 * Oracle verification core — evidence consistency and contradiction detection.
 *
 * Pure computation helpers for assessing whether a thesis has consistent
 * evidential support. No DB access.
 *
 * Maps to `oracleVerificationCore` in the legacy shared/oracle layer.
 */

import type { OracleThesisEvidenceRole } from '../../types/oracle/shared.ts';

export type UncertaintyLevel = 'low' | 'medium' | 'high';

export interface EvidenceWeightItem {
  role: OracleThesisEvidenceRole;
  weight: number;
}

export interface VerificationResult {
  /** True when contradicting weight is less than 30 % of total evidence weight. */
  consistent: boolean;
  /** Sum of validation weights. */
  validationWeight: number;
  /** Sum of contradiction weights. */
  contradictionWeight: number;
  /** Ratio of contradictions to total evidence weight (0–1). */
  contradictionRatio: number;
  uncertaintyLevel: UncertaintyLevel;
}

/**
 * Assess the consistency of evidence items for a thesis.
 *
 * Inspiration-role items are neutral and not counted toward validation
 * or contradiction totals.
 */
export function assessEvidenceConsistency(items: EvidenceWeightItem[]): VerificationResult {
  const validationWeight = items
    .filter((e) => e.role === 'validation')
    .reduce((s, e) => s + e.weight, 0);

  const contradictionWeight = items
    .filter((e) => e.role === 'contradiction')
    .reduce((s, e) => s + e.weight, 0);

  const totalWeight = validationWeight + contradictionWeight;
  const contradictionRatio = totalWeight === 0 ? 0 : contradictionWeight / totalWeight;

  const consistent = contradictionRatio < 0.3;
  const uncertaintyLevel = computeUncertaintyLevel(contradictionRatio, totalWeight);

  return {
    consistent,
    validationWeight,
    contradictionWeight,
    contradictionRatio,
    uncertaintyLevel,
  };
}

/**
 * Derive an uncertainty level from the contradiction ratio and total evidence weight.
 *
 * Low evidence volume increases uncertainty regardless of ratio.
 */
export function computeUncertaintyLevel(
  contradictionRatio: number,
  totalWeight: number,
): UncertaintyLevel {
  if (totalWeight < 1) return 'high';
  if (contradictionRatio >= 0.5) return 'high';
  if (contradictionRatio >= 0.2) return 'medium';
  return 'low';
}

export type ContradictionSeverity = 'none' | 'minor' | 'major' | 'fatal';

/**
 * Classify the severity of a contradiction based on its weight relative
 * to the total evidence weight.
 */
export function classifyContradiction(
  contradictionWeight: number,
  totalWeight: number,
): ContradictionSeverity {
  if (totalWeight === 0 || contradictionWeight === 0) return 'none';
  const ratio = contradictionWeight / totalWeight;
  if (ratio >= 0.7) return 'fatal';
  if (ratio >= 0.4) return 'major';
  if (ratio >= 0.15) return 'minor';
  return 'none';
}
