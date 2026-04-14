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
      const parsed = JSON.parse(value);
      return isPlainObject(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return isPlainObject(value) ? (value as Record<string, unknown>) : {};
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalizes a jsonb array field. Returns the parsed array, or [] on failure.
 * Handles both string-encoded JSON (test adapters) and already-parsed arrays
 * (Supabase/PostgREST in production).
 */
export function parseJsonbArray(value: unknown): unknown[] {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}
