/**
 * Charter-domain validation guards.
 * Lightweight, throw-on-failure helpers used by Charter service factories.
 */

export function assertNonEmpty(value: string, field: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${field} must not be empty`);
  }
}

export function assertConfidence(confidence: number): void {
  if (confidence < 0 || confidence > 100) {
    throw new Error('confidence must be between 0 and 100');
  }
}

export function assertPositiveAmount(amount: number): void {
  if (amount <= 0) {
    throw new Error('amount must be positive');
  }
}
