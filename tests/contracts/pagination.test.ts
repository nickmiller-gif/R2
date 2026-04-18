/**
 * Tests for the shared pagination helper used by R2 service list() methods.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  withPagination,
} from '../../src/lib/service-utils/pagination.js';

describe('withPagination', () => {
  it('applies defaults when filter is undefined', () => {
    expect(withPagination(undefined)).toEqual({
      limit: DEFAULT_PAGE_LIMIT,
      offset: 0,
    });
  });

  it('applies defaults when filter omits limit/offset', () => {
    const result = withPagination<{ name?: string; limit?: number; offset?: number }>({
      name: 'charlie',
    });
    expect(result).toEqual({
      name: 'charlie',
      limit: DEFAULT_PAGE_LIMIT,
      offset: 0,
    });
  });

  it('honors explicit limit/offset under the ceiling', () => {
    expect(withPagination({ limit: 25, offset: 100 })).toEqual({
      limit: 25,
      offset: 100,
    });
  });

  it('caps limit at MAX_PAGE_LIMIT', () => {
    expect(withPagination({ limit: 5000 })).toEqual({
      limit: MAX_PAGE_LIMIT,
      offset: 0,
    });
  });

  it('accepts custom defaultLimit and maxLimit', () => {
    expect(
      withPagination({ limit: 500 }, { defaultLimit: 10, maxLimit: 100 }),
    ).toEqual({ limit: 100, offset: 0 });
    expect(withPagination(undefined, { defaultLimit: 10, maxLimit: 100 })).toEqual({
      limit: 10,
      offset: 0,
    });
  });

  it('preserves unrelated filter fields', () => {
    const result = withPagination({ status: 'active', limit: 10 });
    expect(result).toEqual({ status: 'active', limit: 10, offset: 0 });
  });
});
