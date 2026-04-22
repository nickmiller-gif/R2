/**
 * Tests for Charter-domain validation guards (lib/charter/validate.ts).
 */
import { describe, it, expect } from 'vitest';
import {
  assertNonEmpty,
  assertMaxLength,
  assertConfidence,
  assertConfidence01,
  assertScore,
  assertPositiveAmount,
  assertIso8601Date,
  assertNonNegativeAmountNumeric,
} from '../../src/lib/charter/validate.js';

describe('assertNonEmpty', () => {
  it('accepts a non-empty string', () => {
    expect(() => assertNonEmpty('hello', 'title')).not.toThrow();
  });

  it('accepts a string with internal whitespace', () => {
    expect(() => assertNonEmpty('hello world', 'title')).not.toThrow();
  });

  it('throws for an empty string', () => {
    expect(() => assertNonEmpty('', 'title')).toThrow('title must not be empty');
  });

  it('throws for a whitespace-only string', () => {
    expect(() => assertNonEmpty('   ', 'title')).toThrow('title must not be empty');
  });

  it('includes the field name in the error message', () => {
    expect(() => assertNonEmpty('', 'policyName')).toThrow('policyName must not be empty');
  });
});

describe('assertConfidence', () => {
  it('accepts the minimum boundary value (0)', () => {
    expect(() => assertConfidence(0)).not.toThrow();
  });

  it('accepts the maximum boundary value (100)', () => {
    expect(() => assertConfidence(100)).not.toThrow();
  });

  it('accepts a value in the middle of the range', () => {
    expect(() => assertConfidence(50)).not.toThrow();
    expect(() => assertConfidence(75)).not.toThrow();
  });

  it('throws for a value below 0', () => {
    expect(() => assertConfidence(-1)).toThrow('confidence must be between 0 and 100');
  });

  it('throws for a value above 100', () => {
    expect(() => assertConfidence(101)).toThrow('confidence must be between 0 and 100');
  });
});

describe('assertMaxLength', () => {
  it('accepts strings with length below or equal to max', () => {
    expect(() => assertMaxLength('hello', 'title', 5)).not.toThrow();
    expect(() => assertMaxLength('hey', 'title', 5)).not.toThrow();
  });

  it('throws when length exceeds max', () => {
    expect(() => assertMaxLength('welcome', 'title', 5)).toThrow(
      'title must not exceed 5 characters'
    );
  });
});

describe('assertConfidence01', () => {
  it('accepts boundary values between 0.0 and 1.0', () => {
    expect(() => assertConfidence01(0, 'confidence01')).not.toThrow();
    expect(() => assertConfidence01(1, 'confidence01')).not.toThrow();
  });

  it('throws for out-of-range values', () => {
    expect(() => assertConfidence01(-0.0001, 'confidence01')).toThrow(
      'confidence01 must be between 0.0 and 1.0'
    );
    expect(() => assertConfidence01(1.0001, 'confidence01')).toThrow(
      'confidence01 must be between 0.0 and 1.0'
    );
  });
});

describe('assertScore', () => {
  it('accepts valid score boundaries and midpoint', () => {
    expect(() => assertScore(0)).not.toThrow();
    expect(() => assertScore(50)).not.toThrow();
    expect(() => assertScore(100)).not.toThrow();
  });

  it('throws for scores outside 0-100', () => {
    expect(() => assertScore(-1)).toThrow('score must be between 0 and 100');
    expect(() => assertScore(101)).toThrow('score must be between 0 and 100');
  });
});

describe('assertPositiveAmount', () => {
  it('accepts a positive integer', () => {
    expect(() => assertPositiveAmount(1)).not.toThrow();
    expect(() => assertPositiveAmount(100)).not.toThrow();
  });

  it('accepts a positive decimal', () => {
    expect(() => assertPositiveAmount(0.01)).not.toThrow();
    expect(() => assertPositiveAmount(99.99)).not.toThrow();
  });

  it('throws for zero', () => {
    expect(() => assertPositiveAmount(0)).toThrow('amount must be positive');
  });

  it('throws for a negative value', () => {
    expect(() => assertPositiveAmount(-1)).toThrow('amount must be positive');
    expect(() => assertPositiveAmount(-0.01)).toThrow('amount must be positive');
  });
});

describe('assertNonNegativeAmountNumeric', () => {
  it('accepts zero and positive decimals as strings', () => {
    expect(() => assertNonNegativeAmountNumeric('0')).not.toThrow();
    expect(() => assertNonNegativeAmountNumeric(' 1250000.50 ')).not.toThrow();
  });

  it('rejects empty, negative, non-finite', () => {
    expect(() => assertNonNegativeAmountNumeric('')).toThrow(/empty/);
    expect(() => assertNonNegativeAmountNumeric('-0.01')).toThrow(/non-negative/);
    expect(() => assertNonNegativeAmountNumeric('NaN')).toThrow(/non-negative/);
    expect(() => assertNonNegativeAmountNumeric('Infinity')).toThrow(/non-negative/);
  });
});

describe('assertIso8601Date', () => {
  it('accepts valid ISO dates and date-times', () => {
    expect(() => assertIso8601Date('2026-04-22', 'effectiveDate')).not.toThrow();
    expect(() => assertIso8601Date('2026-04-22T05:26:51.225Z', 'effectiveDate')).not.toThrow();
  });

  it('throws for empty or whitespace values', () => {
    expect(() => assertIso8601Date('', 'effectiveDate')).toThrow('effectiveDate must not be empty');
    expect(() => assertIso8601Date('   ', 'effectiveDate')).toThrow(
      'effectiveDate must not be empty'
    );
  });

  it('throws for invalid date strings', () => {
    expect(() => assertIso8601Date('not-a-date', 'effectiveDate')).toThrow(
      'effectiveDate must be a valid ISO 8601 date'
    );
  });
});
