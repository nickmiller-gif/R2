/**
 * Oracle temporal analysis — temporal diff and temporal drift.
 *
 * Pure computation helpers for measuring signal age, staleness, and
 * score drift across time. No DB access.
 *
 * Maps to `temporalDiff` and `temporalDrift` in the legacy shared/oracle layer.
 */

export interface TemporalDiff {
  /** Absolute difference in milliseconds. */
  deltaMs: number;
  /** Difference in whole days (floor). */
  deltaDays: number;
  /** Whether the second instant is after the first. */
  isForward: boolean;
}

/**
 * Compute the structured temporal difference between two Date values.
 */
export function temporalDiff(from: Date, to: Date): TemporalDiff {
  const deltaMs = to.getTime() - from.getTime();
  return {
    deltaMs,
    deltaDays: Math.floor(Math.abs(deltaMs) / (1000 * 60 * 60 * 24)),
    isForward: deltaMs >= 0,
  };
}

export interface ScoreSnapshot {
  /** UTC timestamp for this snapshot. */
  recordedAt: Date;
  /** Score value at this point in time (0–100). */
  score: number;
}

export interface TemporalDrift {
  /** Score delta from oldest to newest snapshot. */
  totalDrift: number;
  /** Average per-day score change over the observation window. */
  driftPerDay: number;
  /** Direction of the overall drift. */
  trend: 'rising' | 'falling' | 'stable';
  /** Time window covered by the snapshots in days. */
  windowDays: number;
}

/**
 * Measure the drift of a scored entity across a series of snapshots.
 *
 * Requires at least two snapshots ordered by time. Returns a zeroed result
 * for fewer than two snapshots.
 */
export function temporalDrift(snapshots: ScoreSnapshot[]): TemporalDrift {
  if (snapshots.length < 2) {
    return { totalDrift: 0, driftPerDay: 0, trend: 'stable', windowDays: 0 };
  }

  const sorted = [...snapshots].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalDrift = last.score - first.score;
  const windowMs = last.recordedAt.getTime() - first.recordedAt.getTime();
  const windowDays = windowMs / (1000 * 60 * 60 * 24);
  const driftPerDay = windowDays > 0 ? totalDrift / windowDays : 0;

  const trend: TemporalDrift['trend'] =
    totalDrift > 2 ? 'rising' : totalDrift < -2 ? 'falling' : 'stable';

  return { totalDrift, driftPerDay, trend, windowDays };
}
