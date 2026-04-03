/**
 * Tests for the provenance clock utilities (lib/provenance/clock.ts).
 */
import { describe, it, expect } from 'vitest';
import {
  nowUtc,
  toUtc,
  isValidUtcDate,
  requireUtc,
  toIsoUtc,
} from '../../src/lib/provenance/clock.js';

describe('nowUtc', () => {
  it('returns a Date instance', () => {
    const result = nowUtc();
    expect(result).toBeInstanceOf(Date);
  });

  it('returns a valid date', () => {
    expect(isValidUtcDate(nowUtc())).toBe(true);
  });

  it('returns a date close to the current time', () => {
    const before = Date.now();
    const result = nowUtc();
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });
});

describe('toUtc', () => {
  it('normalizes an ISO string to a Date', () => {
    const result = toUtc('2026-04-03T12:00:00.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2026-04-03T12:00:00.000Z');
  });

  it('preserves a Date input unchanged', () => {
    const input = new Date('2025-01-01T00:00:00.000Z');
    const result = toUtc(input);
    expect(result.getTime()).toBe(input.getTime());
  });

  it('accepts a numeric timestamp', () => {
    const ts = new Date('2026-04-03T12:00:00.000Z').getTime();
    const result = toUtc(ts);
    expect(result.toISOString()).toBe('2026-04-03T12:00:00.000Z');
  });
});

describe('isValidUtcDate', () => {
  it('returns true for a valid date', () => {
    expect(isValidUtcDate(new Date('2026-04-03T00:00:00.000Z'))).toBe(true);
  });

  it('returns false for an invalid date (NaN)', () => {
    expect(isValidUtcDate(new Date('not-a-date'))).toBe(false);
  });
});

describe('requireUtc', () => {
  it('returns a valid date for a well-formed ISO string', () => {
    const result = requireUtc('2026-04-03T09:00:00.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2026-04-03T09:00:00.000Z');
  });

  it('accepts a Date input', () => {
    const input = new Date('2025-06-15T00:00:00.000Z');
    const result = requireUtc(input);
    expect(result.getTime()).toBe(input.getTime());
  });

  it('throws RangeError for an invalid string', () => {
    expect(() => requireUtc('not-a-date')).toThrow(RangeError);
  });
});

describe('toIsoUtc', () => {
  it('formats a date as an ISO 8601 UTC string', () => {
    const date = new Date('2026-04-03T15:30:00.000Z');
    expect(toIsoUtc(date)).toBe('2026-04-03T15:30:00.000Z');
  });

  it('always ends with Z (UTC designator)', () => {
    const result = toIsoUtc(nowUtc());
    expect(result.endsWith('Z')).toBe(true);
  });
});
