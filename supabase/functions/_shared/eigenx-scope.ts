/**
 * Default EigenX retrieval policy scope by principal.
 *
 * - Roles in EIGENX_FULL_ACCESS_ROLES (default: admin) use the org-wide default
 *   (EIGENX_DEFAULT_POLICY_SCOPE or eigenx).
 * - Everyone else is limited to personal supplements: eigenx:user:<userId> only,
 *   unless eigen_policy_access_grants expand their allowed tags.
 */
import { POLICY_TAG_EIGENX, policyTagEigenxUser } from './eigen-policy.ts';
import type { CharterRole } from './rbac.ts';

const ALL_ROLES: CharterRole[] = ['member', 'reviewer', 'operator', 'counsel', 'admin'];

export function readEigenxEnvDefaultPolicyScope(): string[] {
  const raw = Deno.env.get('EIGENX_DEFAULT_POLICY_SCOPE')?.trim();
  if (!raw) return [POLICY_TAG_EIGENX];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Comma-separated charter roles that may retrieve the full org EigenX default scope. */
export function readEigenxFullAccessRoles(): Set<CharterRole> {
  const raw = Deno.env.get('EIGENX_FULL_ACCESS_ROLES')?.trim();
  if (!raw) return new Set<CharterRole>(['admin']);
  const out = new Set<CharterRole>();
  for (const part of raw.split(',')) {
    const r = part.trim() as CharterRole;
    if (ALL_ROLES.includes(r)) out.add(r);
  }
  return out.size > 0 ? out : new Set<CharterRole>(['admin']);
}

export function hasFullEigenxAccess(roles: CharterRole[]): boolean {
  const full = readEigenxFullAccessRoles();
  return roles.some((r) => full.has(r));
}

/** When the client omits policy_scope: org-wide default vs personal tag only. */
export function defaultEigenxRetrievePolicyScope(userId: string, roles: CharterRole[]): string[] {
  if (hasFullEigenxAccess(roles)) return readEigenxEnvDefaultPolicyScope();
  return [policyTagEigenxUser(userId)];
}

/**
 * When the client sends policy_scope: full-access principals may use any requested tags (still
 * intersected with grants). Others may only pass their personal tag or sub-tags
 * (eigenx:user:<id>:...).
 */
export function clampExplicitEigenxPolicyScope(
  userId: string,
  roles: CharterRole[],
  explicit: string[],
): string[] {
  if (hasFullEigenxAccess(roles)) return explicit;
  const personal = policyTagEigenxUser(userId);
  const filtered = explicit.filter((t) => t === personal || t.startsWith(`${personal}:`));
  return filtered.length > 0 ? filtered : [personal];
}

/** Widget eigenx mode: site registry default for full-access users; personal tag for others. */
export function widgetEigenxInitialPolicyScope(
  userId: string,
  roles: CharterRole[],
  siteDefaultScope: string[],
): string[] {
  if (hasFullEigenxAccess(roles)) {
    return siteDefaultScope.length > 0 ? siteDefaultScope : [POLICY_TAG_EIGENX];
  }
  return [policyTagEigenxUser(userId)];
}
