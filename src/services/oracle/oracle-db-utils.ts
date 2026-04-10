/**
 * Shared Oracle DB utility helpers.
 */

/**
 * Normalizes a jsonb field value returned by the DB driver.
 * Supabase's JS client may return jsonb columns as a parsed object or, in some
 * test/adapter contexts, as a JSON string. This helper handles both cases and
 * falls back to an empty object for null/undefined values.
 */
export function parseJsonbField(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (value ?? {}) as Record<string, unknown>;
}
