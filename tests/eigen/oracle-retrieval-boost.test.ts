import { describe, it, expect } from 'vitest';
import {
  oracleCompositeBoost,
  parseOracleRetrievalBoostCap,
} from '../../src/lib/eigen/oracle-retrieval-boost.js';

describe('parseOracleRetrievalBoostCap', () => {
  it('uses fallback for empty or invalid', () => {
    expect(parseOracleRetrievalBoostCap(undefined)).toBe(0.1);
    expect(parseOracleRetrievalBoostCap('')).toBe(0.1);
    expect(parseOracleRetrievalBoostCap('x')).toBe(0.1);
  });

  it('clamps to [0, 0.25]', () => {
    expect(parseOracleRetrievalBoostCap('-1')).toBe(0);
    expect(parseOracleRetrievalBoostCap('0.15')).toBe(0.15);
    expect(parseOracleRetrievalBoostCap('9')).toBe(0.25);
  });
});

describe('oracleCompositeBoost', () => {
  const cap = 0.1;

  it('returns 0 without signal id', () => {
    expect(oracleCompositeBoost(null, 80, cap)).toBe(0);
    expect(oracleCompositeBoost(undefined, 80, cap)).toBe(0);
    expect(oracleCompositeBoost('', 80, cap)).toBe(0);
  });

  it('scales by relevance 0–100', () => {
    expect(oracleCompositeBoost('sig', 0, cap)).toBe(0);
    expect(oracleCompositeBoost('sig', 50, cap)).toBeCloseTo(0.05);
    expect(oracleCompositeBoost('sig', 100, cap)).toBeCloseTo(0.1);
    expect(oracleCompositeBoost('sig', 200, cap)).toBeCloseTo(0.1);
  });

  it('uses partial cap when signal linked but relevance missing', () => {
    expect(oracleCompositeBoost('sig', null, cap)).toBeCloseTo(0.035);
    expect(oracleCompositeBoost('sig', undefined, cap)).toBeCloseTo(0.035);
  });
});
