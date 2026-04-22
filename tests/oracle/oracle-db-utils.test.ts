import { describe, it, expect } from 'vitest';
import { parseJsonbField, parseJsonbArray } from '../../src/services/oracle/oracle-db-utils.ts';
import {
  parseJsonbField as parseJsonbFieldJs,
  parseJsonbArray as parseJsonbArrayJs,
} from '../../src/services/oracle/oracle-db-utils.js';

function runSharedJsonbAssertions(
  fieldParser: (value: unknown) => Record<string, unknown>,
  arrayParser: (value: unknown) => unknown[]
): void {
  expect(fieldParser('{"key":"value"}')).toEqual({ key: 'value' });
  expect(fieldParser('{"bad"')).toEqual({});
  expect(fieldParser({ a: 1 })).toEqual({ a: 1 });
  expect(fieldParser(null)).toEqual({});

  expect(arrayParser('[1,2,3]')).toEqual([1, 2, 3]);
  expect(arrayParser('{"not":"array"}')).toEqual([]);
  expect(arrayParser('[broken')).toEqual([]);
  expect(arrayParser(['x'])).toEqual(['x']);
  expect(arrayParser({ nope: true })).toEqual([]);
}

describe('oracle-db-utils.ts', () => {
  it('handles valid and invalid jsonb field/array payloads', () => {
    runSharedJsonbAssertions(parseJsonbField, parseJsonbArray);
  });
});

describe('oracle-db-utils.js mirror', () => {
  it('matches behavior for valid and invalid jsonb field/array payloads', () => {
    runSharedJsonbAssertions(parseJsonbFieldJs, parseJsonbArrayJs);
  });
});
