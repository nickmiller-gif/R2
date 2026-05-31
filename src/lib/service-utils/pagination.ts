/**
 * Pagination defaults shared by R2 service list() implementations.
 *
 * All list methods cap `limit` at 1000 and default to 50 when unset;
 * `offset` defaults to 0. Centralized here so the contract is consistent.
 */

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 1000;

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

/**
 * Normalize a filter's `limit`/`offset` into enforced defaults + ceiling.
 * Returns a shallow copy of the filter with the resolved values set.
 */
export function withPagination<T extends { limit?: number; offset?: number }>(
  filter: T | undefined,
  options: PaginationOptions = {},
): T & PaginationParams {
  const defaultLimit = options.defaultLimit ?? DEFAULT_PAGE_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_PAGE_LIMIT;
  // Clamp to [1, maxLimit]. Without the lower bound a negative `limit` survives
  // Math.min and Postgres interprets `LIMIT -1` as "no limit" — an unbounded
  // scan. `offset` is likewise floored at 0.
  const limit = Math.min(Math.max(1, filter?.limit ?? defaultLimit), maxLimit);
  const offset = Math.max(0, filter?.offset ?? 0);
  return { ...(filter ?? ({} as T)), limit, offset };
}
