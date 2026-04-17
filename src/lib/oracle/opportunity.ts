/**
 * Oracle opportunity model — opportunity scoring and multi-horizon timing.
 *
 * Pure computation helpers for scoring opportunities from signal aggregates
 * and analysing timing across short/medium/long horizons. No DB access.
 *
 * Maps to `opportunityModel` and `multiHorizonTiming` in the legacy
 * shared/oracle layer.
 */

import type { ConfidenceBand } from '../../types/oracle/signal.ts';
import { aggregateScores, scoreToConfidenceBand } from './scoring.ts';

export interface OpportunitySignalInput {
  score: number;
  weight: number;
  /** Optional tags that can amplify or discount the signal. */
  tags?: string[];
}

export interface OpportunityScore {
  /** Composite opportunity score (0–100). */
  score: number;
  confidence: ConfidenceBand;
  /** How many signals contributed. */
  signalCount: number;
}

/**
 * Compute an opportunity score from a set of weighted signals.
 */
export function scoreOpportunity(signals: OpportunitySignalInput[]): OpportunityScore {
  const score = aggregateScores(signals);
  return {
    score,
    confidence: scoreToConfidenceBand(score),
    signalCount: signals.length,
  };
}

export type TimingHorizon = 'immediate' | 'near' | 'medium' | 'long';

export interface HorizonWindow {
  horizon: TimingHorizon;
  /** Lower bound in days from reference point (inclusive). */
  minDays: number;
  /** Upper bound in days from reference point (exclusive); null = unbounded. */
  maxDays: number | null;
}

/** Standard horizon windows. */
export const HORIZON_WINDOWS: HorizonWindow[] = [
  { horizon: 'immediate', minDays: 0, maxDays: 7 },
  { horizon: 'near', minDays: 7, maxDays: 30 },
  { horizon: 'medium', minDays: 30, maxDays: 90 },
  { horizon: 'long', minDays: 90, maxDays: null },
];

/**
 * Classify a future event into a timing horizon.
 *
 * @param daysFromNow  Number of days until the event (must be ≥ 0).
 */
export function classifyHorizon(daysFromNow: number): TimingHorizon {
  for (const w of HORIZON_WINDOWS) {
    if (w.maxDays === null || daysFromNow < w.maxDays) {
      if (daysFromNow >= w.minDays) return w.horizon;
    }
  }
  return 'long';
}

export interface HorizonScore {
  horizon: TimingHorizon;
  /** Opportunity score weighted by proximity — nearer horizons are amplified. */
  weightedScore: number;
  proximityFactor: number;
}

/**
 * Analyse an opportunity's score across all timing horizons.
 *
 * `daysToAction` is how many days from now the opportunity window opens.
 * Nearer horizons receive a higher proximity multiplier.
 */
export function multiHorizonTiming(
  opportunityScore: number,
  daysToAction: number,
): HorizonScore[] {
  const horizon = classifyHorizon(daysToAction);
  // Proximity factors: more weight for nearer horizons
  const proximityFactors: Record<TimingHorizon, number> = {
    immediate: 1.0,
    near: 0.8,
    medium: 0.6,
    long: 0.4,
  };

  return HORIZON_WINDOWS.map((w) => {
    const proximityFactor =
      w.horizon === horizon ? proximityFactors[w.horizon] : proximityFactors[w.horizon] * 0.5;
    const weightedScore = Math.round(
      Math.min(100, Math.max(0, opportunityScore * proximityFactor)),
    );
    return { horizon: w.horizon, weightedScore, proximityFactor };
  });
}
