/**
 * Tests for Charter-domain validation guards (lib/charter/validate.ts).
 */
import { describe, it, expect } from 'vitest';
import {
  assertNonEmpty,
  assertConfidence,
  assertPositiveAmount,
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
