/**
 * Centralized timestamp helper for provenance records.
 * All provenance timestamps must go through this module to ensure
 * consistent UTC-normalized Date values.
 */

export type UtcDateInput = Date | string | number;

/** Returns the current UTC timestamp as a Date. */
export function nowUtc(): Date {
  return new Date();
}

/** Normalizes any Date-like value to a UTC Date. */
export function toUtc(value: UtcDateInput): Date {
  return new Date(value instanceof Date ? value.getTime() : value);
}

/** Returns true when the Date is a valid UTC-normalized timestamp value. */
export function isValidUtcDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

/** Normalizes and validates any Date-like value as UTC. */
export function requireUtc(value: UtcDateInput): Date {
  const normalized = toUtc(value);
  if (!isValidUtcDate(normalized)) {
    throw new RangeError('Invalid UTC date value.');
  }
  return normalized;
}

/** Formats a Date as an ISO 8601 UTC string. */
export function toIsoUtc(value: Date): string {
  return value.toISOString();
}
