/**
 * Request-validation helpers for edge functions — NODE/TEST ENVIRONMENT.
 *
 * These are pure utilities that operate on standard JS types and are
 * testable in Node.js without a Deno runtime.
 *
 * The Deno edge-function equivalents live in supabase/functions/_shared/validate.ts.
 * Keep the two in sync.
 */

// ---------------------------------------------------------------------------
// Payload allowlisting
// ---------------------------------------------------------------------------

/**
 * Returns a new object containing only the keys listed in `allowedFields`.
 *
 * Prevents mass-assignment by ensuring that only known, intentional fields
 * are passed to `insert` / `update` DB calls.  Fields whose value is
 * `undefined` are omitted from the result.
 *
 * ```ts
 * const payload = allowlistPayload(raw, ['title', 'status', 'entity_id']);
 * await client.from('charter_rights').insert([payload]);
 * ```
 */
export function allowlistPayload(
  raw: unknown,
  allowedFields: ReadonlyArray<string>,
): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const body = raw as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body && body[field] !== undefined) {
      result[field] = body[field];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Pagination safety
// ---------------------------------------------------------------------------

/**
 * Parses `limit` and `offset` query parameters from a URL with safe defaults
 * and a hard maximum to prevent unbounded list queries.
 *
 * ```ts
 * const { limit, offset } = safePaginationParams(url, 50, 200);
 * await client.from('table').select('*').range(offset, offset + limit - 1);
 * ```
 */
export function safePaginationParams(
  url: URL,
  defaultLimit = 50,
  maxLimit = 200,
): { limit: number; offset: number } {
  const rawLimit = url.searchParams.get('limit');
  const rawOffset = url.searchParams.get('offset');
  const limit = Math.min(
    maxLimit,
    Math.max(1, Number.parseInt(rawLimit ?? String(defaultLimit), 10) || defaultLimit),
  );
  const offset = Math.max(0, Number.parseInt(rawOffset ?? '0', 10) || 0);
  return { limit, offset };
}
