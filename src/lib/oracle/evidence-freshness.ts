/**
 * Oracle evidence freshness — staleness detection and feed rescore scheduling.
 *
 * Pure computation helpers for determining whether evidence items are fresh
 * or stale and identifying candidates for rescoring. No DB access.
 *
 * Maps to `evidenceFreshness` and `feedRescore` in the legacy shared/oracle layer.
 */

export type FreshnessLabel = 'fresh' | 'aging' | 'stale' | 'expired';

export interface FreshnessResult {
  /** Age of the item in days. */
  ageDays: number;
  /** Freshness score: 100 = just created, 0 = maximally stale. */
  freshnessScore: number;
  label: FreshnessLabel;
}

/**
 * Compute the freshness of an evidence item.
 *
 * Default half-life is 30 days: an item loses half its freshness score
 * every 30 days using exponential decay.
 *
 * @param createdAt   When the item was created/updated.
 * @param now         Reference point (pass a fixed Date in tests).
 * @param halfLifeDays  Days until freshness score halves (default 30).
 */
export function computeFreshness(
  createdAt: Date,
  now: Date,
  halfLifeDays = 30,
): FreshnessResult {
  const ageDays = Math.max(
    0,
    (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  const decayRate = Math.LN2 / halfLifeDays;
  const freshnessScore = Math.round(100 * Math.exp(-decayRate * ageDays));
  const label = classifyFreshness(freshnessScore);

  return { ageDays, freshnessScore, label };
}

/**
 * Classify a freshness score into a qualitative label.
 *
 * - fresh   : score ≥ 70
 * - aging   : score ≥ 40
 * - stale   : score ≥ 15
 * - expired : score < 15
 */
export function classifyFreshness(freshnessScore: number): FreshnessLabel {
  if (freshnessScore >= 70) return 'fresh';
  if (freshnessScore >= 40) return 'aging';
  if (freshnessScore >= 15) return 'stale';
  return 'expired';
}

/**
 * Returns true when an item should be rescored based on its freshness.
 */
export function isStale(freshness: FreshnessResult): boolean {
  return freshness.label === 'stale' || freshness.label === 'expired';
}

export interface EvidenceItemAge {
  id: string;
  createdAt: Date;
}

export interface RescoreCandidate {
  id: string;
  freshness: FreshnessResult;
}

/**
 * Identify evidence items that should be queued for rescoring.
 *
 * Returns only stale/expired items, sorted oldest-first.
 */
export function feedRescore(
  items: EvidenceItemAge[],
  now: Date,
  halfLifeDays = 30,
): RescoreCandidate[] {
  return items
    .map((item) => ({
      id: item.id,
      freshness: computeFreshness(item.createdAt, now, halfLifeDays),
    }))
    .filter((c) => isStale(c.freshness))
    .sort((a, b) => a.freshness.freshnessScore - b.freshness.freshnessScore);
}
