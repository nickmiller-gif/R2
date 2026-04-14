/**
 * Shared role definitions for the R2 Charter RBAC system (Node/Vitest layer).
 *
 * Single source of truth for the role type and hierarchy order.
 * Import from here in service-layer code so that adding a new role
 * only requires one change.
 *
 * The Deno edge layer mirrors this in supabase/functions/_shared/roles.ts.
 */

/** Must match the `charter_role` enum in the database. */
export type CharterRole = 'member' | 'reviewer' | 'operator' | 'counsel' | 'admin';

/**
 * Role hierarchy ordered from lowest to highest privilege.
 * Index position determines precedence: higher index = more privilege.
 */
export const ROLE_HIERARCHY: readonly CharterRole[] = [
  'member',
  'reviewer',
  'operator',
  'counsel',
  'admin',
] as const;

/**
 * Returns true if `callerRoles` contains at least one role at or above
 * `minimumRole` in the hierarchy.
 */
export function hasMinimumRole(
  callerRoles: CharterRole[],
  minimumRole: CharterRole,
): boolean {
  const minimumIndex = ROLE_HIERARCHY.indexOf(minimumRole);
  return callerRoles.some((r) => ROLE_HIERARCHY.indexOf(r) >= minimumIndex);
}
