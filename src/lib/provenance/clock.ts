/**
 * Centralized timestamp helper for provenance records.
 * All provenance timestamps must go through this module to ensure
 * consistent UTC-normalized Date values.
 */

/** Returns the current UTC timestamp as a Date. */
export function nowUtc(): Date {
  return new Date();
}

/** Normalizes any Date-like value to a UTC Date. */
export function toUtc(value: Date | string | number): Date {
  return new Date(value instanceof Date ? value.getTime() : value);
}

/** Formats a Date as an ISO 8601 UTC string. */
export function toIsoUtc(value: Date): string {
  return value.toISOString();
}
