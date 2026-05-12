import { describe, expect, it } from 'vitest';
import {
  computeRetrievalAnnLimitBase,
  computeRetrievalAnnLimitWithDocumentTagScope,
} from '../../src/lib/eigen/eigen-retrieve-ann.js';

describe('computeRetrievalAnnLimitBase', () => {
  it('scales with max_chunks and caps at 500', () => {
    expect(computeRetrievalAnnLimitBase(20)).toBe(160);
    expect(computeRetrievalAnnLimitBase(5)).toBe(100);
    expect(computeRetrievalAnnLimitBase(100)).toBe(500);
  });
});

describe('computeRetrievalAnnLimitWithDocumentTagScope', () => {
  it('widens probe when document tag filter is active', () => {
    const base = 100;
    expect(computeRetrievalAnnLimitWithDocumentTagScope(base)).toBe(300);
    expect(computeRetrievalAnnLimitWithDocumentTagScope(200)).toBe(500);
  });
});
