import { requireUtc } from '../provenance/clock.js';
import type { TimeWindow, UtcDateInput, ValidityWindow } from '../../types/shared/temporal.js';

export const UTC_TIMEZONE = 'UTC' as const;

function assertOrderedWindow(start: Date | null, end: Date | null, startLabel: string, endLabel: string): void {
  if (start && end && start.getTime() > end.getTime()) {
    throw new RangeError(`${startLabel} must be less than or equal to ${endLabel}.`);
  }
}

function normalizeBoundary(value: UtcDateInput | null | undefined): Date | null {
  return value == null ? null : requireUtc(value);
}

export function makeTimeWindow(start?: UtcDateInput | null, end?: UtcDateInput | null): TimeWindow {
  const normalizedStart = normalizeBoundary(start);
  const normalizedEnd = normalizeBoundary(end);
  assertOrderedWindow(normalizedStart, normalizedEnd, 'start', 'end');
  return {
    start: normalizedStart,
    end: normalizedEnd,
  };
}

export function makeValidityWindow(validFrom?: UtcDateInput | null, validTo?: UtcDateInput | null): ValidityWindow {
  const normalizedStart = normalizeBoundary(validFrom);
  const normalizedEnd = normalizeBoundary(validTo);
  assertOrderedWindow(normalizedStart, normalizedEnd, 'validFrom', 'validTo');
  return {
    validFrom: normalizedStart,
    validTo: normalizedEnd,
  };
}

export function validityWindowToTimeWindow(window: ValidityWindow): TimeWindow {
  return makeTimeWindow(window.validFrom, window.validTo);
}

export function timeWindowContains(window: TimeWindow, value: UtcDateInput): boolean {
  const instant = requireUtc(value).getTime();
  const start = window.start?.getTime();
  const end = window.end?.getTime();
  return (start == null || instant >= start) && (end == null || instant <= end);
}

export function timeWindowsOverlap(left: TimeWindow, right: TimeWindow): boolean {
  const leftStart = left.start?.getTime() ?? Number.NEGATIVE_INFINITY;
  const leftEnd = left.end?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightStart = right.start?.getTime() ?? Number.NEGATIVE_INFINITY;
  const rightEnd = right.end?.getTime() ?? Number.POSITIVE_INFINITY;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

export function intersectTimeWindows(left: TimeWindow, right: TimeWindow): TimeWindow | null {
  if (!timeWindowsOverlap(left, right)) {
    return null;
  }

  const start =
    left.start == null
      ? right.start
      : right.start == null
        ? left.start
        : left.start.getTime() >= right.start.getTime()
          ? left.start
          : right.start;

  const end =
    left.end == null
      ? right.end
      : right.end == null
        ? left.end
        : left.end.getTime() <= right.end.getTime()
          ? left.end
          : right.end;

  return makeTimeWindow(start, end);
}
