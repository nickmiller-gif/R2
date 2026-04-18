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
  const limit = Math.min(filter?.limit ?? defaultLimit, maxLimit);
  const offset = filter?.offset ?? 0;
  return { ...(filter ?? ({} as T)), limit, offset };
}
