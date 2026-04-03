/**
 * Oracle cross-run diff — compare outputs from successive Oracle runs.
 *
 * Pure computation helpers for detecting what changed between two Oracle
 * analysis runs so that callers can surface meaningful deltas. No DB access.
 *
 * Maps to `crossRunDiff` in the legacy shared/oracle layer.
 */

export interface RunScoreEntry {
  id: string;
  score: number;
  status: string;
}

export type ScoreChangeSeverity = 'none' | 'minor' | 'significant' | 'major';

export interface ScoreDelta {
  id: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  severity: ScoreChangeSeverity;
}

export interface CrossRunDiff {
  /** Items where the score changed between runs. */
  scoreDeltas: ScoreDelta[];
  /** IDs present in the current run but absent from the previous run. */
  added: string[];
  /** IDs present in the previous run but absent from the current run. */
  removed: string[];
  /** IDs present in both runs but with a status change. */
  statusChanged: Array<{ id: string; previousStatus: string; currentStatus: string }>;
}

/**
 * Classify the severity of a score change.
 *
 * - none        : |delta| = 0
 * - minor       : |delta| < 10
 * - significant : |delta| < 25
 * - major       : |delta| ≥ 25
 */
export function classifyScoreChange(delta: number): ScoreChangeSeverity {
  const abs = Math.abs(delta);
  if (abs === 0) return 'none';
  if (abs < 10) return 'minor';
  if (abs < 25) return 'significant';
  return 'major';
}

/**
 * Compute the full diff between a previous and current set of run entries.
 *
 * Only entries with a non-zero score delta are included in `scoreDeltas`.
 */
export function crossRunDiff(
  previous: RunScoreEntry[],
  current: RunScoreEntry[],
): CrossRunDiff {
  const prevMap = new Map(previous.map((e) => [e.id, e]));
  const currMap = new Map(current.map((e) => [e.id, e]));

  const scoreDeltas: ScoreDelta[] = [];
  const statusChanged: CrossRunDiff['statusChanged'] = [];

  for (const [id, curr] of currMap) {
    const prev = prevMap.get(id);
    if (!prev) continue;

    const delta = curr.score - prev.score;
    if (delta !== 0) {
      scoreDeltas.push({
        id,
        previousScore: prev.score,
        currentScore: curr.score,
        delta,
        severity: classifyScoreChange(delta),
      });
    }

    if (curr.status !== prev.status) {
      statusChanged.push({
        id,
        previousStatus: prev.status,
        currentStatus: curr.status,
      });
    }
  }

  const added = [...currMap.keys()].filter((id) => !prevMap.has(id));
  const removed = [...prevMap.keys()].filter((id) => !currMap.has(id));

  return {
    scoreDeltas: scoreDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    added,
    removed,
    statusChanged,
  };
}
