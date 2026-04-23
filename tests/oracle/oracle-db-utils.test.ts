import { describe, expect, it } from 'vitest';
import { parseJsonbArray, parseJsonbField } from '../../src/services/oracle/oracle-db-utils.js';

describe('oracle-db-utils', () => {
  describe('parseJsonbField', () => {
    it('parses stringified json objects', () => {
      expect(parseJsonbField('{"foo":"bar","n":3}')).toEqual({ foo: 'bar', n: 3 });
    });

    it('returns empty object for invalid json strings', () => {
      expect(parseJsonbField('{invalid')).toEqual({});
    });

    it('returns empty object for nullish values', () => {
      expect(parseJsonbField(null)).toEqual({});
      expect(parseJsonbField(undefined)).toEqual({});
    });

    it('passes through non-string object values', () => {
      const value = { source: 'row' };
      expect(parseJsonbField(value)).toEqual(value);
    });
  });

  describe('parseJsonbArray', () => {
    it('parses stringified arrays', () => {
      expect(parseJsonbArray('[1,2,3]')).toEqual([1, 2, 3]);
    });

    it('returns empty array for invalid strings', () => {
      expect(parseJsonbArray('[not-json')).toEqual([]);
    });

    it('returns empty array for non-array payloads', () => {
      expect(parseJsonbArray('{"a":1}')).toEqual([]);
      expect(parseJsonbArray({ a: 1 })).toEqual([]);
      expect(parseJsonbArray(null)).toEqual([]);
    });

    it('passes through array values', () => {
      const rows = [{ id: 1 }, { id: 2 }];
      expect(parseJsonbArray(rows)).toEqual(rows);
    });
  });
});
