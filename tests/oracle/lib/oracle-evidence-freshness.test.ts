/**
 * Tests for Oracle evidence freshness and feed rescore.
 */
import { describe, it, expect } from 'vitest';
import {
  computeFreshness,
  classifyFreshness,
  isStale,
  feedRescore,
} from '../../../src/lib/oracle/evidence-freshness.js';

const NOW = new Date('2026-04-03T12:00:00.000Z');

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

describe('computeFreshness', () => {
  it('returns a freshness score of 100 for brand-new items', () => {
    const result = computeFreshness(NOW, NOW);
    expect(result.ageDays).toBe(0);
    expect(result.freshnessScore).toBe(100);
    expect(result.label).toBe('fresh');
  });

  it('returns ~50 score at the half-life boundary (30 days)', () => {
    const result = computeFreshness(daysAgo(30), NOW);
    expect(result.freshnessScore).toBeCloseTo(50, 0);
    expect(result.label).toBe('aging');
  });

  it('returns stale label for 60-day-old items', () => {
    const result = computeFreshness(daysAgo(60), NOW);
    expect(result.label).toBe('stale');
  });

  it('returns expired label for very old items', () => {
    const result = computeFreshness(daysAgo(150), NOW);
    expect(result.label).toBe('expired');
  });

  it('respects a custom half-life', () => {
    // Half-life of 10 days: after 10 days score should be ~50
    const result = computeFreshness(daysAgo(10), NOW, 10);
    expect(result.freshnessScore).toBeCloseTo(50, 0);
  });
});

describe('classifyFreshness', () => {
  it('returns fresh for scores >= 70', () => {
    expect(classifyFreshness(100)).toBe('fresh');
    expect(classifyFreshness(70)).toBe('fresh');
  });

  it('returns aging for scores in [40, 70)', () => {
    expect(classifyFreshness(69)).toBe('aging');
    expect(classifyFreshness(40)).toBe('aging');
  });

  it('returns stale for scores in [15, 40)', () => {
    expect(classifyFreshness(39)).toBe('stale');
    expect(classifyFreshness(15)).toBe('stale');
  });

  it('returns expired for scores < 15', () => {
    expect(classifyFreshness(14)).toBe('expired');
    expect(classifyFreshness(0)).toBe('expired');
  });
});

describe('isStale', () => {
  it('returns true for stale items', () => {
    const result = computeFreshness(daysAgo(60), NOW);
    expect(isStale(result)).toBe(true);
  });

  it('returns true for expired items', () => {
    const result = computeFreshness(daysAgo(150), NOW);
    expect(isStale(result)).toBe(true);
  });

  it('returns false for fresh items', () => {
    const result = computeFreshness(daysAgo(1), NOW);
    expect(isStale(result)).toBe(false);
  });
});

describe('feedRescore', () => {
  it('returns only stale/expired items', () => {
    const items = [
      { id: 'fresh-1', createdAt: daysAgo(1) },
      { id: 'stale-1', createdAt: daysAgo(60) },
      { id: 'expired-1', createdAt: daysAgo(150) },
    ];
    const candidates = feedRescore(items, NOW);
    const ids = candidates.map((c) => c.id);
    expect(ids).toContain('stale-1');
    expect(ids).toContain('expired-1');
    expect(ids).not.toContain('fresh-1');
  });

  it('sorts oldest-first (lowest freshness score first)', () => {
    const items = [
      { id: 'older', createdAt: daysAgo(150) },
      { id: 'newer', createdAt: daysAgo(60) },
    ];
    const candidates = feedRescore(items, NOW);
    expect(candidates[0].id).toBe('older');
  });

  it('returns empty array when no items are stale', () => {
    const candidates = feedRescore(
      [{ id: 'fresh', createdAt: daysAgo(1) }],
      NOW,
    );
    expect(candidates).toHaveLength(0);
  });
});
