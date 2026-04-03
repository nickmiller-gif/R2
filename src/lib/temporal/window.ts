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

function maxBoundary(left: Date | null, right: Date | null): Date | null {
  if (left == null) return right;
  if (right == null) return left;
  return left.getTime() >= right.getTime() ? left : right;
}

function minBoundary(left: Date | null, right: Date | null): Date | null {
  if (left == null) return right;
  if (right == null) return left;
  return left.getTime() <= right.getTime() ? left : right;
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

  return makeTimeWindow(maxBoundary(left.start, right.start), minBoundary(left.end, right.end));
}
