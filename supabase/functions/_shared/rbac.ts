import { getServiceClient } from './supabase.ts';
import { corsHeaders } from './cors.ts';
import { type CharterRole, ROLE_HIERARCHY } from './roles.ts';

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
// Types (re-exported for backward compatibility)
// ---------------------------------------------------------------------------

export type { CharterRole };

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

function serverErrorResponse(message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}

// ---------------------------------------------------------------------------
// Role lookup
// ---------------------------------------------------------------------------

/**
 * Fetches all roles assigned to a user from `charter_user_roles`.
 * Authenticated users can read this table under RLS; this helper uses the
 * service-role client so shared RBAC checks can perform the lookup
 * consistently from backend code without relying on a caller-scoped auth client.
 *
 * Throws when the Supabase query itself fails so callers can distinguish a
 * database/network error (500) from a successful lookup that returned zero
 * rows (403 — no roles assigned).
 */
export async function getUserRoles(userId: string): Promise<CharterRole[]> {
  const client = getServiceClient();
  const { data, error } = await client
    .from('charter_user_roles')
    .select('role')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Role lookup failed: ${error.message}`);
  }

  if (!data) return [];
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
  let roles: CharterRole[];
  try {
    roles = await getUserRoles(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Role lookup failed';
    return { ok: false, response: serverErrorResponse(message) };
  }

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
  let roles: CharterRole[];
  try {
    roles = await getUserRoles(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Role lookup failed';
    return { ok: false, response: serverErrorResponse(message) };
  }

  if (!roles.includes(role)) {
    return {
      ok: false,
      response: forbiddenResponse(`Requires exact role: ${role}`),
    };
  }

  return { ok: true, roles };
}
