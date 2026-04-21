/**
 * Request-body sanitization helpers for edge functions.
 *
 * Every Charter / Oracle / MEG / Foundation / Eigen write endpoint runs with
 * the `service_role` client (RLS policies scope writes to service_role) and
 * therefore bypasses per-column RLS. That's fine IF the edge function itself
 * filters the incoming body to a known allowlist of columns. Passing
 * `req.json()` straight into `.insert([body])` / `.update(body)` exposes a
 * mass-assignment vulnerability — a valid operator JWT can set fields that
 * should only come from the server (created_by, status, id, audit_*).
 *
 * Use `pickFields` for inserts and updates:
 *
 *   const INSERT_FIELDS = ['linked_table', 'linked_id', 'decision_type', 'title',
 *     'rationale', 'outcome', 'status', 'decided_by', 'decided_at',
 *     'confidence', 'reviewed_by'] as const;
 *
 *   const body = await req.json();
 *   const row = {
 *     ...pickFields(body, INSERT_FIELDS),
 *     created_by: auth.claims.userId, // server-injected, never trusted from client
 *   };
 *   await client.from('charter_decisions').insert([row]);
 *
 * Use `rejectExtraFields` in higher-assurance paths where silently-dropped
 * unknown fields would hide a client bug:
 *
 *   try {
 *     rejectExtraFields(body, INSERT_FIELDS);
 *   } catch (err) {
 *     return errorResponse(err.message, 400);
 *   }
 */

/**
 * Return a new object containing only the allowed keys from `body`.
 * Keys not in the allowlist are silently dropped. Values are passed through
 * unchanged (column type validation is left to the database CHECK constraints).
 */
export function pickFields<K extends string>(
  body: unknown,
  allowed: readonly K[],
): Partial<Record<K, unknown>> {
  if (!body || typeof body !== 'object') return {};
  const src = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in src) out[key] = src[key];
  }
  return out as Partial<Record<K, unknown>>;
}

/**
 * Throws if `body` contains any key outside `allowed`. Useful when the
 * endpoint wants to surface client bugs (typoed field names, stale API
 * usage) rather than silently drop them.
 */
export function rejectExtraFields<K extends string>(
  body: unknown,
  allowed: readonly K[],
): void {
  if (!body || typeof body !== 'object') return;
  const src = body as Record<string, unknown>;
  const allowedSet = new Set<string>(allowed as readonly string[]);
  const unexpected: string[] = [];
  for (const key of Object.keys(src)) {
    if (!allowedSet.has(key)) unexpected.push(key);
  }
  if (unexpected.length > 0) {
    throw new Error(
      `Unexpected fields in request body: ${unexpected.join(', ')}. ` +
        `Allowed: ${allowed.join(', ')}`,
    );
  }
}

/**
 * Convenience: pick allowed fields AND inject server-controlled ones.
 *
 *   const row = sanitizeInsert(body, INSERT_FIELDS, {
 *     created_by: auth.claims.userId,
 *   });
 *
 * Server-controlled fields always win over anything the client tried to set.
 */
export function sanitizeInsert<K extends string, S extends Record<string, unknown>>(
  body: unknown,
  allowed: readonly K[],
  serverFields: S,
): Partial<Record<K, unknown>> & S {
  return {
    ...pickFields(body, allowed),
    ...serverFields,
  };
}

/**
 * Convenience for PATCH/update handlers: pick allowed-for-update fields and
 * strip primary-key/audit columns that must never be mutated by a client.
 * The caller is responsible for not including `id`, `created_at`,
 * `created_by`, etc., in the allow-list.
 */
export function sanitizeUpdate<K extends string>(
  body: unknown,
  allowed: readonly K[],
): Partial<Record<K, unknown>> {
  return pickFields(body, allowed);
}
