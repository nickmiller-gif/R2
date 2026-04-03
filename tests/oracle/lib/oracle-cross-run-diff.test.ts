/**
 * Tests for Oracle cross-run diff.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyScoreChange,
  crossRunDiff,
} from '../../../src/lib/oracle/cross-run-diff.js';
import type { RunScoreEntry } from '../../../src/lib/oracle/cross-run-diff.js';

describe('classifyScoreChange', () => {
  it('returns none for a zero delta', () => {
    expect(classifyScoreChange(0)).toBe('none');
  });

  it('returns minor for small deltas', () => {
    expect(classifyScoreChange(5)).toBe('minor');
    expect(classifyScoreChange(-9)).toBe('minor');
  });

  it('returns significant for medium deltas', () => {
    expect(classifyScoreChange(15)).toBe('significant');
    expect(classifyScoreChange(-24)).toBe('significant');
  });

  it('returns major for large deltas', () => {
    expect(classifyScoreChange(25)).toBe('major');
    expect(classifyScoreChange(-50)).toBe('major');
  });
});

describe('crossRunDiff', () => {
  const prev: RunScoreEntry[] = [
    { id: 'a', score: 60, status: 'scored' },
    { id: 'b', score: 80, status: 'scored' },
    { id: 'c', score: 50, status: 'scored' },
  ];

  const curr: RunScoreEntry[] = [
    { id: 'a', score: 85, status: 'scored' },   // +25 → major
    { id: 'b', score: 80, status: 'superseded' }, // 0 score delta, status change
    { id: 'd', score: 70, status: 'scored' },    // new
  ];

  it('detects added IDs', () => {
    const diff = crossRunDiff(prev, curr);
    expect(diff.added).toContain('d');
    expect(diff.added).not.toContain('a');
  });

  it('detects removed IDs', () => {
    const diff = crossRunDiff(prev, curr);
    expect(diff.removed).toContain('c');
    expect(diff.removed).not.toContain('a');
  });

  it('records score deltas for changed entries', () => {
    const diff = crossRunDiff(prev, curr);
    const aDelta = diff.scoreDeltas.find((d) => d.id === 'a');
    expect(aDelta).toBeDefined();
    expect(aDelta!.delta).toBe(25);
    expect(aDelta!.severity).toBe('major');
  });

  it('does not include entries with no score change in scoreDeltas', () => {
    const diff = crossRunDiff(prev, curr);
    const bDelta = diff.scoreDeltas.find((d) => d.id === 'b');
    expect(bDelta).toBeUndefined();
  });

  it('detects status changes', () => {
    const diff = crossRunDiff(prev, curr);
    const bStatus = diff.statusChanged.find((s) => s.id === 'b');
    expect(bStatus).toBeDefined();
    expect(bStatus!.previousStatus).toBe('scored');
    expect(bStatus!.currentStatus).toBe('superseded');
  });

  it('sorts scoreDeltas by absolute delta descending', () => {
    const p: RunScoreEntry[] = [
      { id: 'x', score: 50, status: 'scored' },
      { id: 'y', score: 50, status: 'scored' },
    ];
    const c: RunScoreEntry[] = [
      { id: 'x', score: 90, status: 'scored' },  // +40
      { id: 'y', score: 60, status: 'scored' },  // +10
    ];
    const diff = crossRunDiff(p, c);
    expect(diff.scoreDeltas[0].id).toBe('x');
    expect(diff.scoreDeltas[1].id).toBe('y');
  });

  it('returns empty diff for identical runs', () => {
    const entries: RunScoreEntry[] = [
      { id: 'a', score: 70, status: 'scored' },
    ];
    const diff = crossRunDiff(entries, entries);
    expect(diff.scoreDeltas).toHaveLength(0);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.statusChanged).toHaveLength(0);
  });
});
