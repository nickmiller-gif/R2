import { describe, expect, it } from 'vitest';
import {
  UTC_TIMEZONE,
  intersectTimeWindows,
  isValidUtcDate,
  makeTimeWindow,
  makeValidityWindow,
  requireUtc,
  timeWindowContains,
  timeWindowsOverlap,
  toIsoUtc,
  validityWindowToTimeWindow,
} from '../../src/lib/temporal/index.js';

describe('UTC helpers', () => {
  it('uses UTC as the shared timezone standard', () => {
    expect(UTC_TIMEZONE).toBe('UTC');
  });

  it('normalizes valid UTC inputs', () => {
    const value = requireUtc('2026-04-03T09:00:00.000Z');
    expect(isValidUtcDate(value)).toBe(true);
    expect(toIsoUtc(value)).toBe('2026-04-03T09:00:00.000Z');
  });

  it('rejects invalid UTC inputs', () => {
    expect(() => requireUtc('not-a-date')).toThrow(RangeError);
  });
});

describe('makeTimeWindow', () => {
  it('normalizes bounded windows to UTC dates', () => {
    const window = makeTimeWindow('2026-04-03T09:00:00.000Z', '2026-04-03T10:00:00.000Z');
    expect(window.start).toEqual(new Date('2026-04-03T09:00:00.000Z'));
    expect(window.end).toEqual(new Date('2026-04-03T10:00:00.000Z'));
  });

  it('supports unbounded ranges', () => {
    expect(makeTimeWindow(null, '2026-04-03T10:00:00.000Z')).toEqual({
      start: null,
      end: new Date('2026-04-03T10:00:00.000Z'),
    });
  });

  it('rejects reversed ranges', () => {
    expect(() => makeTimeWindow('2026-04-03T11:00:00.000Z', '2026-04-03T10:00:00.000Z')).toThrow(
      'start must be less than or equal to end.',
    );
  });
});

describe('makeValidityWindow', () => {
  it('uses validity-specific boundary names', () => {
    const window = makeValidityWindow('2026-04-03T09:00:00.000Z', '2026-04-03T10:00:00.000Z');
    expect(window.validFrom).toEqual(new Date('2026-04-03T09:00:00.000Z'));
    expect(window.validTo).toEqual(new Date('2026-04-03T10:00:00.000Z'));
  });

  it('converts validity windows into generic time windows', () => {
    const timeWindow = validityWindowToTimeWindow(
      makeValidityWindow('2026-04-03T09:00:00.000Z', '2026-04-03T10:00:00.000Z'),
    );
    expect(timeWindow).toEqual({
      start: new Date('2026-04-03T09:00:00.000Z'),
      end: new Date('2026-04-03T10:00:00.000Z'),
    });
  });
});

describe('time-range helpers', () => {
  it('checks whether an instant falls within an inclusive window', () => {
    const window = makeTimeWindow('2026-04-03T09:00:00.000Z', '2026-04-03T10:00:00.000Z');
    expect(timeWindowContains(window, '2026-04-03T09:00:00.000Z')).toBe(true);
    expect(timeWindowContains(window, '2026-04-03T09:30:00.000Z')).toBe(true);
    expect(timeWindowContains(window, '2026-04-03T10:00:00.000Z')).toBe(true);
    expect(timeWindowContains(window, '2026-04-03T10:00:00.001Z')).toBe(false);
  });

  it('treats touching windows as overlapping', () => {
    const left = makeTimeWindow('2026-04-03T09:00:00.000Z', '2026-04-03T10:00:00.000Z');
    const right = makeTimeWindow('2026-04-03T10:00:00.000Z', '2026-04-03T11:00:00.000Z');
    expect(timeWindowsOverlap(left, right)).toBe(true);
  });

  it('returns the overlapping intersection', () => {
    const left = makeTimeWindow('2026-04-03T09:00:00.000Z', '2026-04-03T11:00:00.000Z');
    const right = makeTimeWindow('2026-04-03T10:00:00.000Z', '2026-04-03T12:00:00.000Z');
    expect(intersectTimeWindows(left, right)).toEqual({
      start: new Date('2026-04-03T10:00:00.000Z'),
      end: new Date('2026-04-03T11:00:00.000Z'),
    });
  });

  it('returns null for disjoint windows', () => {
    const left = makeTimeWindow('2026-04-03T09:00:00.000Z', '2026-04-03T10:00:00.000Z');
    const right = makeTimeWindow('2026-04-03T10:00:00.001Z', '2026-04-03T11:00:00.000Z');
    expect(intersectTimeWindows(left, right)).toBeNull();
  });
});
