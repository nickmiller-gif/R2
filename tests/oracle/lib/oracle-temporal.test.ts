/**
 * Tests for Oracle temporal analysis primitives.
 */
import { describe, it, expect } from 'vitest';
import { temporalDiff, temporalDrift } from '../../../src/lib/oracle/temporal.js';
import type { ScoreSnapshot } from '../../../src/lib/oracle/temporal.js';

describe('temporalDiff', () => {
  const from = new Date('2026-01-01T00:00:00.000Z');
  const to = new Date('2026-01-11T00:00:00.000Z');

  it('computes positive delta when to is after from', () => {
    const diff = temporalDiff(from, to);
    expect(diff.deltaMs).toBe(10 * 24 * 60 * 60 * 1000);
    expect(diff.deltaDays).toBe(10);
    expect(diff.isForward).toBe(true);
  });

  it('computes negative delta when to is before from', () => {
    const diff = temporalDiff(to, from);
    expect(diff.deltaMs).toBe(-10 * 24 * 60 * 60 * 1000);
    expect(diff.isForward).toBe(false);
    expect(diff.deltaDays).toBe(10); // deltaDays is always positive
  });

  it('returns zero delta for equal instants', () => {
    const diff = temporalDiff(from, from);
    expect(diff.deltaMs).toBe(0);
    expect(diff.deltaDays).toBe(0);
    expect(diff.isForward).toBe(true);
  });
});

describe('temporalDrift', () => {
  it('returns zeroed result for fewer than two snapshots', () => {
    const result = temporalDrift([]);
    expect(result.totalDrift).toBe(0);
    expect(result.driftPerDay).toBe(0);
    expect(result.trend).toBe('stable');
    expect(result.windowDays).toBe(0);
  });

  it('computes drift between two snapshots', () => {
    const snapshots: ScoreSnapshot[] = [
      { recordedAt: new Date('2026-01-01T00:00:00.000Z'), score: 50 },
      { recordedAt: new Date('2026-01-11T00:00:00.000Z'), score: 70 },
    ];
    const result = temporalDrift(snapshots);
    expect(result.totalDrift).toBe(20);
    expect(result.windowDays).toBeCloseTo(10);
    expect(result.driftPerDay).toBeCloseTo(2);
    expect(result.trend).toBe('rising');
  });

  it('detects falling trend', () => {
    const snapshots: ScoreSnapshot[] = [
      { recordedAt: new Date('2026-01-01T00:00:00.000Z'), score: 80 },
      { recordedAt: new Date('2026-01-11T00:00:00.000Z'), score: 50 },
    ];
    const result = temporalDrift(snapshots);
    expect(result.totalDrift).toBe(-30);
    expect(result.trend).toBe('falling');
  });

  it('detects stable trend when drift is small', () => {
    const snapshots: ScoreSnapshot[] = [
      { recordedAt: new Date('2026-01-01T00:00:00.000Z'), score: 60 },
      { recordedAt: new Date('2026-01-11T00:00:00.000Z'), score: 61 },
    ];
    const result = temporalDrift(snapshots);
    expect(result.trend).toBe('stable');
  });

  it('handles unsorted snapshots', () => {
    const snapshots: ScoreSnapshot[] = [
      { recordedAt: new Date('2026-01-11T00:00:00.000Z'), score: 70 },
      { recordedAt: new Date('2026-01-01T00:00:00.000Z'), score: 50 },
    ];
    const result = temporalDrift(snapshots);
    expect(result.totalDrift).toBe(20);
    expect(result.trend).toBe('rising');
  });
});
