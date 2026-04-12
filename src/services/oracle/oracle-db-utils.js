/**
 * Runtime JS mirror for Supabase edge bundling.
 * Keep in sync with oracle-db-utils.ts.
 */
export function parseJsonbField(value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value ?? {};
}

export function parseJsonbArray(value) {
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
