/**
 * Tests for Oracle verification core.
 */
import { describe, it, expect } from 'vitest';
import {
  assessEvidenceConsistency,
  computeUncertaintyLevel,
  classifyContradiction,
} from '../../../src/lib/oracle/verification.js';
import type { EvidenceWeightItem } from '../../../src/lib/oracle/verification.js';

describe('assessEvidenceConsistency', () => {
  it('returns consistent with low uncertainty when only validation evidence present', () => {
    const items: EvidenceWeightItem[] = [
      { role: 'validation', weight: 3 },
      { role: 'validation', weight: 2 },
    ];
    const result = assessEvidenceConsistency(items);
    expect(result.consistent).toBe(true);
    expect(result.contradictionRatio).toBe(0);
    expect(result.uncertaintyLevel).toBe('low');
  });

  it('returns inconsistent when contradiction weight exceeds 30% of total evidence weight', () => {
    const items: EvidenceWeightItem[] = [
      { role: 'validation', weight: 2 },
      { role: 'contradiction', weight: 2 },
    ];
    const result = assessEvidenceConsistency(items);
    expect(result.consistent).toBe(false);
    expect(result.contradictionRatio).toBe(0.5);
    expect(result.uncertaintyLevel).toBe('high');
  });

  it('treats inspiration items as neutral', () => {
    const items: EvidenceWeightItem[] = [
      { role: 'inspiration', weight: 10 },
      { role: 'validation', weight: 4 },
    ];
    const result = assessEvidenceConsistency(items);
    expect(result.validationWeight).toBe(4);
    expect(result.contradictionWeight).toBe(0);
    expect(result.consistent).toBe(true);
  });

  it('returns high uncertainty for empty evidence list', () => {
    const result = assessEvidenceConsistency([]);
    expect(result.consistent).toBe(true);
    expect(result.uncertaintyLevel).toBe('high');
  });
});

describe('computeUncertaintyLevel', () => {
  it('returns high when total weight is below 1', () => {
    expect(computeUncertaintyLevel(0, 0.5)).toBe('high');
  });

  it('returns high for ratio >= 0.5', () => {
    expect(computeUncertaintyLevel(0.5, 2)).toBe('high');
  });

  it('returns medium for ratio in [0.2, 0.5)', () => {
    expect(computeUncertaintyLevel(0.3, 2)).toBe('medium');
  });

  it('returns low for ratio < 0.2', () => {
    expect(computeUncertaintyLevel(0.1, 2)).toBe('low');
  });
});

describe('classifyContradiction', () => {
  it('returns none when contradiction weight is 0', () => {
    expect(classifyContradiction(0, 5)).toBe('none');
  });

  it('returns none when total weight is 0', () => {
    expect(classifyContradiction(0, 0)).toBe('none');
  });

  it('returns minor for a small ratio', () => {
    // 1/6 ≈ 0.167
    expect(classifyContradiction(1, 6)).toBe('minor');
  });

  it('returns major for ratio in [0.4, 0.7)', () => {
    // 2/4 = 0.5
    expect(classifyContradiction(2, 4)).toBe('major');
  });

  it('returns fatal for ratio >= 0.7', () => {
    // 7/10 = 0.7
    expect(classifyContradiction(7, 10)).toBe('fatal');
  });
});
