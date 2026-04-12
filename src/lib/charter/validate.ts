/**
 * Charter-domain validation guards.
 * Lightweight, throw-on-failure helpers used by Charter service factories.
 */

export function assertNonEmpty(value: string, field: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${field} must not be empty`);
  }
}

export function assertMaxLength(value: string, field: string, max: number): void {
  if (value.length > max) {
    throw new Error(`${field} must not exceed ${max} characters`);
  }
}

export function assertConfidence(confidence: number): void {
  if (confidence < 0 || confidence > 100) {
    throw new Error('confidence must be between 0 and 100');
  }
}

/** For fields that use a 0.0–1.0 probability scale rather than 0–100. */
export function assertConfidence01(value: number, field: string): void {
  if (value < 0 || value > 1) {
    throw new Error(`${field} must be between 0.0 and 1.0`);
  }
}

export function assertScore(score: number): void {
  if (score < 0 || score > 100) {
    throw new Error('score must be between 0 and 100');
  }
}

export function assertPositiveAmount(amount: number): void {
  if (amount <= 0) {
    throw new Error('amount must be positive');
  }
}

/**
 * Validates that a string is a well-formed ISO 8601 date (YYYY-MM-DD or full datetime).
 * Rejects values that cannot be parsed as a finite date by the Date constructor.
 */
export function assertIso8601Date(value: string, field: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${field} must not be empty`);
  }
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) {
    throw new Error(`${field} must be a valid ISO 8601 date`);
  }
}

/** Charter asset valuations: non-negative decimal string (NUMERIC) accepted from clients. */
export function assertNonNegativeAmountNumeric(s: string): void {
  const t = s.trim();
  if (!t) throw new Error('amountNumeric must not be empty');
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('amountNumeric must be a non-negative finite number');
  }
}
