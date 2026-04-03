/**
 * Tests for Oracle whitespace contracts and gap detection.
 */
import { describe, it, expect } from 'vitest';
import {
  identifyGaps,
  scoreGap,
  classifyGapPriority,
  predictiveGapScore,
} from '../../../src/lib/oracle/whitespace.js';
import type { TopicCoverage, WhitespaceGap, GapContext } from '../../../src/lib/oracle/whitespace.js';

describe('identifyGaps', () => {
  const coverage: TopicCoverage[] = [
    { topicId: 'ai-adoption', coverageScore: 20, evidenceCount: 1 },
    { topicId: 'market-entry', coverageScore: 75, evidenceCount: 10 },
    { topicId: 'pricing', coverageScore: 50, evidenceCount: 3 },
    { topicId: 'regulation', coverageScore: 5, evidenceCount: 0 },
  ];

  it('returns only topics below the default threshold (60)', () => {
    const gaps = identifyGaps(coverage);
    const ids = gaps.map((g) => g.topicId);
    expect(ids).toContain('ai-adoption');
    expect(ids).toContain('pricing');
    expect(ids).toContain('regulation');
    expect(ids).not.toContain('market-entry');
  });

  it('sorts gaps highest-first', () => {
    const gaps = identifyGaps(coverage);
    expect(gaps[0].topicId).toBe('regulation'); // gapScore = 95
    expect(gaps[1].topicId).toBe('ai-adoption'); // gapScore = 80
  });

  it('respects a custom threshold', () => {
    const gaps = identifyGaps(coverage, 80);
    // ai-adoption (20), market-entry (75), pricing (50), regulation (5) are all < 80
    expect(gaps).toHaveLength(4);
  });

  it('computes gapScore as 100 minus coverageScore', () => {
    const gaps = identifyGaps([{ topicId: 'x', coverageScore: 30, evidenceCount: 1 }]);
    expect(gaps[0].gapScore).toBe(70);
  });
});

describe('scoreGap', () => {
  it('returns 0 for a fully-covered topic', () => {
    expect(scoreGap({ topicId: 'x', coverageScore: 100, evidenceCount: 5 })).toBe(0);
  });

  it('returns 100 for a completely uncovered topic', () => {
    expect(scoreGap({ topicId: 'x', coverageScore: 0, evidenceCount: 0 })).toBe(100);
  });
});

describe('classifyGapPriority', () => {
  it('classifies critical gaps', () => {
    expect(classifyGapPriority(90)).toBe('critical');
    expect(classifyGapPriority(80)).toBe('critical');
  });

  it('classifies high gaps', () => {
    expect(classifyGapPriority(70)).toBe('high');
    expect(classifyGapPriority(60)).toBe('high');
  });

  it('classifies medium gaps', () => {
    expect(classifyGapPriority(50)).toBe('medium');
    expect(classifyGapPriority(35)).toBe('medium');
  });

  it('classifies low gaps', () => {
    expect(classifyGapPriority(20)).toBe('low');
    expect(classifyGapPriority(0)).toBe('low');
  });
});

describe('predictiveGapScore', () => {
  const gap: WhitespaceGap = {
    topicId: 'ai-adoption',
    gapScore: 80,
    priority: 'critical',
  };

  const context: GapContext = {
    topicImportance: 90,
    recencyFactor: 0.2,
    closureEase: 0.8,
  };

  it('returns a score between 0 and 100', () => {
    const score = predictiveGapScore(gap, context);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns a higher score for more important topics', () => {
    const lowImportance = predictiveGapScore(gap, { ...context, topicImportance: 10 });
    const highImportance = predictiveGapScore(gap, { ...context, topicImportance: 90 });
    expect(highImportance).toBeGreaterThan(lowImportance);
  });

  it('returns a higher score for larger gaps', () => {
    const smallGap: WhitespaceGap = { ...gap, gapScore: 20 };
    const largeGap: WhitespaceGap = { ...gap, gapScore: 90 };
    expect(predictiveGapScore(largeGap, context)).toBeGreaterThan(
      predictiveGapScore(smallGap, context),
    );
  });
});
