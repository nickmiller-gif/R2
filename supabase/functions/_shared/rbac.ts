import { getServiceClient } from './supabase.ts';
import { corsHeaders } from './cors.ts';

/**
 * RBAC helpers for edge functions (ADR-002).
 *
 * Looks up the verified user's roles from `charter_user_roles` and provides
 * a `requireRole()` guard that returns a 403 response when the user lacks
 * the required role.
 *
 * Usage:
 * ```ts
 * const auth = await guardAuth(req);
 * if (!auth.ok) return auth.response;
 *
 * // For write endpoints — require at least 'operator' role
 * const roleCheck = await requireRole(auth.claims.userId, 'operator');
 * if (!roleCheck.ok) return roleCheck.response;
 * ```
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Must match the `charter_role` enum in the database. */
export type CharterRole = 'member' | 'reviewer' | 'operator' | 'counsel' | 'admin';

/**
 * Role hierarchy — higher index = more privilege.
 * `requireRole('operator')` succeeds if the user has 'operator', 'counsel', or 'admin'.
 */
const ROLE_HIERARCHY: CharterRole[] = [
  'member',
  'reviewer',
  'operator',
  'counsel',
  'admin',
];

export type RoleCheckResult =
  | { ok: true; roles: CharterRole[] }
  | { ok: false; response: Response };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function forbiddenResponse(message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}

// ---------------------------------------------------------------------------
// Role lookup
// ---------------------------------------------------------------------------

/**
 * Fetches all roles assigned to a user from `charter_user_roles`.
 * Uses the service-role client because RLS on the roles table requires it.
 */
export async function getUserRoles(userId: string): Promise<CharterRole[]> {
  const client = getServiceClient();
  const { data, error } = await client
    .from('charter_user_roles')
    .select('role')
    .eq('user_id', userId);

  if (error || !data) return [];
  return data.map((row: { role: string }) => row.role as CharterRole);
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Requires the user to hold at least `minimumRole` (or higher in the hierarchy).
 *
 * Returns `{ ok: true, roles }` on success or `{ ok: false, response }` with
 * a ready-to-return 403 JSON response on failure.
 */
export async function requireRole(
  userId: string,
  minimumRole: CharterRole,
): Promise<RoleCheckResult> {
  const roles = await getUserRoles(userId);

  if (roles.length === 0) {
    return { ok: false, response: forbiddenResponse('No roles assigned') };
  }

  const minimumIndex = ROLE_HIERARCHY.indexOf(minimumRole);
  const hasPermission = roles.some(
    (r) => ROLE_HIERARCHY.indexOf(r) >= minimumIndex,
  );

  if (!hasPermission) {
    return {
      ok: false,
      response: forbiddenResponse(`Requires role: ${minimumRole} or higher`),
    };
  }

  return { ok: true, roles };
}

/**
 * Requires the user to hold a specific exact role (no hierarchy).
 * Useful for admin-only operations.
 */
export async function requireExactRole(
  userId: string,
  role: CharterRole,
): Promise<RoleCheckResult> {
  const roles = await getUserRoles(userId);

  if (!roles.includes(role)) {
    return {
      ok: false,
      response: forbiddenResponse(`Requires exact role: ${role}`),
    };
  }

  return { ok: true, roles };
}
