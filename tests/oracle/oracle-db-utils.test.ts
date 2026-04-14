/**
 * Tests for shared Oracle DB utility helpers (services/oracle/oracle-db-utils.ts).
 *
 * Covers the already-parsed object path (parseJsonbField) and the already-parsed
 * array path (parseJsonbArray), the string-encoded JSON paths for both, and the
 * error/fallback paths when JSON.parse fails or the parsed value has an
 * unexpected shape.
 */
import { describe, it, expect } from 'vitest';
import { parseJsonbField, parseJsonbArray } from '../../src/services/oracle/oracle-db-utils.js';

// ─── parseJsonbField ──────────────────────────────────────────────────────────

describe('parseJsonbField', () => {
  it('returns the parsed object when value is a valid JSON string', () => {
    expect(parseJsonbField('{"key":"value","n":42}')).toEqual({ key: 'value', n: 42 });
  });

  it('returns an empty object when the JSON string is syntactically invalid', () => {
    expect(parseJsonbField('not-valid-json')).toEqual({});
  });

  it('returns an empty object for a truncated JSON string', () => {
    expect(parseJsonbField('{"unclosed":')).toEqual({});
  });

  it('passes through an already-parsed object unchanged', () => {
    const obj = { a: 1, b: 'two' };
    expect(parseJsonbField(obj)).toEqual(obj);
  });

  it('returns an empty object for null', () => {
    expect(parseJsonbField(null)).toEqual({});
  });

  it('returns an empty object for undefined', () => {
    expect(parseJsonbField(undefined)).toEqual({});
  });

  it('returns an empty object for a non-object value (number)', () => {
    expect(parseJsonbField(42)).toEqual({});
  });

  it('returns an empty object when the JSON string parses to a non-object (array)', () => {
    expect(parseJsonbField('[1,2,3]')).toEqual({});
  });

  it('returns an empty object when the JSON string parses to a non-object (number)', () => {
    expect(parseJsonbField('42')).toEqual({});
  });

  it('returns an empty object for an already-parsed array', () => {
    expect(parseJsonbField([1, 2, 3])).toEqual({});
  });
});

// ─── parseJsonbArray ──────────────────────────────────────────────────────────

describe('parseJsonbArray', () => {
  it('returns the parsed array when value is a valid JSON array string', () => {
    expect(parseJsonbArray('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('returns an empty array when the JSON string parses to a non-array', () => {
    expect(parseJsonbArray('{"not":"array"}')).toEqual([]);
  });

  it('returns an empty array when the JSON string is syntactically invalid', () => {
    expect(parseJsonbArray('not-json')).toEqual([]);
  });

  it('returns an empty array for a truncated JSON string', () => {
    expect(parseJsonbArray('[1,2,')).toEqual([]);
  });

  it('passes through an already-parsed array unchanged', () => {
    const arr = ['a', 'b', 'c'];
    expect(parseJsonbArray(arr)).toEqual(arr);
  });

  it('returns an empty array for null', () => {
    expect(parseJsonbArray(null)).toEqual([]);
  });

  it('returns an empty array for undefined', () => {
    expect(parseJsonbArray(undefined)).toEqual([]);
  });

  it('returns an empty array for a non-array value (number)', () => {
    expect(parseJsonbArray(42)).toEqual([]);
  });

  it('returns an empty array for a non-array value (plain object)', () => {
    expect(parseJsonbArray({ key: 'value' })).toEqual([]);
  });
});
