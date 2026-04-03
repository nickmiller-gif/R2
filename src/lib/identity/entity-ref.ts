import type { EntityRef } from '../../types/shared/identity.js';

/**
 * Creates a canonical EntityRef for the given domain and id.
 * Optionally accepts a kind hint.
 */
export function makeEntityRef(domain: string, id: string, kind?: string): EntityRef {
  return kind !== undefined ? { domain, id, kind } : { domain, id };
}

/**
 * Returns a stable string key for an EntityRef suitable for use as a Map
 * key or cache key.  Format: `<domain>:<id>`.
 */
export function entityRefKey(ref: EntityRef): string {
  return `${ref.domain}:${ref.id}`;
}

/**
 * Returns true when two EntityRefs point to the same entity (same domain and
 * id).  The optional `kind` field is intentionally ignored for equality.
 */
export function entityRefsEqual(a: EntityRef, b: EntityRef): boolean {
  return a.domain === b.domain && a.id === b.id;
}
