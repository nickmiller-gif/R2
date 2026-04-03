/**
 * Tests for Oracle scoring primitives (reweighting execution core).
 */
import { describe, it, expect } from 'vitest';
import {
  clampScore,
  reweightScore,
  scoreToConfidenceBand,
  aggregateScores,
  blendEvidenceScore,
} from '../../../src/lib/oracle/scoring.js';

describe('clampScore', () => {
  it('returns the value unchanged when in range', () => {
    expect(clampScore(50)).toBe(50);
    expect(clampScore(0)).toBe(0);
    expect(clampScore(100)).toBe(100);
  });

  it('clamps values above 100', () => {
    expect(clampScore(120)).toBe(100);
  });

  it('clamps values below 0', () => {
    expect(clampScore(-10)).toBe(0);
  });

  it('rounds fractional values', () => {
    expect(clampScore(50.6)).toBe(51);
    expect(clampScore(50.4)).toBe(50);
  });
});

describe('reweightScore', () => {
  it('applies a positive adjustment', () => {
    expect(reweightScore(60, 20, 1)).toBe(80);
  });

  it('applies a negative adjustment', () => {
    expect(reweightScore(60, -20, 1)).toBe(40);
  });

  it('scales adjustment by weight', () => {
    expect(reweightScore(60, 20, 0.5)).toBe(70);
  });

  it('clamps result to 100', () => {
    expect(reweightScore(90, 20, 1)).toBe(100);
  });

  it('clamps result to 0', () => {
    expect(reweightScore(10, -20, 1)).toBe(0);
  });

  it('ignores adjustment when weight is 0', () => {
    expect(reweightScore(60, 20, 0)).toBe(60);
  });

  it('clamps weight above 1 to 1', () => {
    expect(reweightScore(60, 20, 2)).toBe(80);
  });
});

describe('scoreToConfidenceBand', () => {
  it('returns high for scores >= 70', () => {
    expect(scoreToConfidenceBand(70)).toBe('high');
    expect(scoreToConfidenceBand(100)).toBe('high');
  });

  it('returns medium for scores in [40, 70)', () => {
    expect(scoreToConfidenceBand(40)).toBe('medium');
    expect(scoreToConfidenceBand(69)).toBe('medium');
  });

  it('returns low for scores < 40', () => {
    expect(scoreToConfidenceBand(0)).toBe('low');
    expect(scoreToConfidenceBand(39)).toBe('low');
  });
});

describe('aggregateScores', () => {
  it('returns 0 for an empty array', () => {
    expect(aggregateScores([])).toBe(0);
  });

  it('returns 0 when all weights are 0', () => {
    expect(aggregateScores([{ score: 80, weight: 0 }])).toBe(0);
  });

  it('computes an equal-weight average', () => {
    expect(aggregateScores([
      { score: 60, weight: 1 },
      { score: 80, weight: 1 },
    ])).toBe(70);
  });

  it('respects different weights', () => {
    // (80 * 3 + 20 * 1) / 4 = 260 / 4 = 65
    expect(aggregateScores([
      { score: 80, weight: 3 },
      { score: 20, weight: 1 },
    ])).toBe(65);
  });
});

describe('blendEvidenceScore', () => {
  it('leaves score unchanged at blend factor 0', () => {
    expect(blendEvidenceScore(60, 90, 0)).toBe(60);
  });

  it('fully replaces score at blend factor 1', () => {
    expect(blendEvidenceScore(60, 90, 1)).toBe(90);
  });

  it('blends proportionally', () => {
    // 60 * 0.5 + 90 * 0.5 = 75
    expect(blendEvidenceScore(60, 90, 0.5)).toBe(75);
  });

  it('clamps result to 100', () => {
    expect(blendEvidenceScore(95, 100, 1)).toBe(100);
  });
});
