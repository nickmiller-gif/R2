/**
 * Tests for Oracle opportunity model and multi-horizon timing.
 */
import { describe, it, expect } from 'vitest';
import {
  scoreOpportunity,
  classifyHorizon,
  multiHorizonTiming,
  HORIZON_WINDOWS,
} from '../../../src/lib/oracle/opportunity.js';

describe('scoreOpportunity', () => {
  it('returns 0 for an empty signal list', () => {
    const result = scoreOpportunity([]);
    expect(result.score).toBe(0);
    expect(result.signalCount).toBe(0);
  });

  it('computes weighted average of signal scores', () => {
    const result = scoreOpportunity([
      { score: 60, weight: 1 },
      { score: 80, weight: 1 },
    ]);
    expect(result.score).toBe(70);
    expect(result.signalCount).toBe(2);
  });

  it('maps score to a confidence band', () => {
    const high = scoreOpportunity([{ score: 85, weight: 1 }]);
    expect(high.confidence).toBe('high');

    const medium = scoreOpportunity([{ score: 55, weight: 1 }]);
    expect(medium.confidence).toBe('medium');

    const low = scoreOpportunity([{ score: 20, weight: 1 }]);
    expect(low.confidence).toBe('low');
  });
});

describe('classifyHorizon', () => {
  it('classifies 0 days as immediate', () => {
    expect(classifyHorizon(0)).toBe('immediate');
  });

  it('classifies 6 days as immediate', () => {
    expect(classifyHorizon(6)).toBe('immediate');
  });

  it('classifies 7 days as near', () => {
    expect(classifyHorizon(7)).toBe('near');
  });

  it('classifies 29 days as near', () => {
    expect(classifyHorizon(29)).toBe('near');
  });

  it('classifies 30 days as medium', () => {
    expect(classifyHorizon(30)).toBe('medium');
  });

  it('classifies 89 days as medium', () => {
    expect(classifyHorizon(89)).toBe('medium');
  });

  it('classifies 90 days as long', () => {
    expect(classifyHorizon(90)).toBe('long');
  });

  it('classifies very large values as long', () => {
    expect(classifyHorizon(365)).toBe('long');
  });
});

describe('multiHorizonTiming', () => {
  it('returns one entry per horizon window', () => {
    const results = multiHorizonTiming(80, 5);
    expect(results).toHaveLength(HORIZON_WINDOWS.length);
  });

  it('gives the matching horizon a higher proximity factor than others', () => {
    // 5 days → immediate horizon
    const results = multiHorizonTiming(80, 5);
    const immediate = results.find((r) => r.horizon === 'immediate');
    const long = results.find((r) => r.horizon === 'long');
    expect(immediate!.proximityFactor).toBeGreaterThan(long!.proximityFactor);
  });

  it('weighted scores are clamped to [0, 100]', () => {
    const results = multiHorizonTiming(100, 0);
    results.forEach((r) => {
      expect(r.weightedScore).toBeGreaterThanOrEqual(0);
      expect(r.weightedScore).toBeLessThanOrEqual(100);
    });
  });
});
