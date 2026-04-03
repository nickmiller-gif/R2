/**
 * Oracle whitespace contracts — gap detection and predictive gap scoring.
 *
 * Pure computation helpers for identifying uncovered areas in an intelligence
 * surface and scoring their priority. No DB access.
 *
 * Maps to `masterWhitespaceContracts`, `gapScanner`, and
 * `predictiveGapScoring` in the legacy shared/oracle layer.
 */

export interface TopicCoverage {
  /** Identifier for the topic or theme. */
  topicId: string;
  /** 0–100: how thoroughly this topic has been covered by existing evidence. */
  coverageScore: number;
  /** Number of evidence items addressing this topic. */
  evidenceCount: number;
}

export interface WhitespaceGap {
  topicId: string;
  /** 0–100: inverse of coverageScore; higher = more uncovered. */
  gapScore: number;
  /** Qualitative priority label derived from gapScore. */
  priority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Identify gaps (uncovered or under-covered topics) from a coverage map.
 *
 * Topics with coverageScore below `threshold` (default 60) are returned
 * as gaps, sorted highest-gap first.
 */
export function identifyGaps(
  coverage: TopicCoverage[],
  threshold = 60,
): WhitespaceGap[] {
  return coverage
    .filter((t) => t.coverageScore < threshold)
    .map((t) => {
      const gapScore = 100 - t.coverageScore;
      return {
        topicId: t.topicId,
        gapScore,
        priority: classifyGapPriority(gapScore),
      };
    })
    .sort((a, b) => b.gapScore - a.gapScore);
}

/**
 * Score a single gap from raw coverage metrics.
 * Returns 0 for fully-covered topics.
 */
export function scoreGap(coverage: TopicCoverage): number {
  return Math.max(0, 100 - coverage.coverageScore);
}

/**
 * Classify a gap's priority from its gap score.
 *
 * - critical : gapScore ≥ 80
 * - high     : gapScore ≥ 60
 * - medium   : gapScore ≥ 35
 * - low      : gapScore < 35
 */
export function classifyGapPriority(
  gapScore: number,
): WhitespaceGap['priority'] {
  if (gapScore >= 80) return 'critical';
  if (gapScore >= 60) return 'high';
  if (gapScore >= 35) return 'medium';
  return 'low';
}

export interface GapContext {
  /** How strategically important this topic is (0–100). */
  topicImportance: number;
  /** How recently this gap was last examined (0–1; 1 = very recent). */
  recencyFactor: number;
  /** Estimated effort to close this gap (0–1; 1 = very easy). */
  closureEase: number;
}

/**
 * Compute a predictive gap score that weighs raw coverage against
 * strategic importance, recency, and ease of closure.
 *
 * Higher scores indicate gaps that are more valuable to address.
 */
export function predictiveGapScore(gap: WhitespaceGap, context: GapContext): number {
  const importanceContribution = context.topicImportance * 0.4;
  const gapContribution = gap.gapScore * 0.4;
  const easeContribution = context.closureEase * 100 * 0.1;
  // Recent gaps are deprioritised slightly (already in-flight); stale gaps
  // get a small urgency boost.
  const recencyBoost = (1 - context.recencyFactor) * 10;
  const raw =
    importanceContribution + gapContribution + easeContribution + recencyBoost;
  return Math.round(Math.min(100, Math.max(0, raw)));
}
