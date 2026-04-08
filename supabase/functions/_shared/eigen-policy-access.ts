import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { CharterRole } from './rbac.ts';
import { getUserRoles } from './rbac.ts';

export interface ResolveEigenxPolicyScopeInput {
  userId: string;
  requestedPolicyScope: string[];
  defaultPolicyScope: string[];
}

export interface ResolveEigenxPolicyScopeResult {
  effectivePolicyScope: string[];
  grantsConfigured: boolean;
  allowedPolicyTags: string[];
}

interface PolicyGrantRow {
  principal_type: 'user' | 'role';
  principal_id: string;
  policy_tag: string;
  status: 'active' | 'paused' | 'revoked';
}

function normalizeTags(input: string[]): string[] {
  return Array.from(
    new Set(input.map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
  );
}

function matchGrantedTag(grantedTag: string, requestedTag: string): boolean {
  if (grantedTag === requestedTag) return true;
  if (grantedTag.endsWith(':*')) {
    const prefix = grantedTag.slice(0, -1);
    return requestedTag.startsWith(prefix);
  }
  return false;
}

function resolveByAllowedTags(requested: string[], allowed: string[]): string[] {
  if (requested.length === 0 || allowed.length === 0) return [];
  return requested.filter((tag) => allowed.some((grant) => matchGrantedTag(grant, tag)));
}

async function loadPolicyTagsForPrincipals(
  client: SupabaseClient,
  principalIds: Array<{ principal_type: 'user' | 'role'; principal_id: string }>,
): Promise<string[]> {
  if (principalIds.length === 0) return [];
  const orClauses = principalIds.map((p) => {
    const escapedId = p.principal_id.replace(/"/g, '\\"');
    return `and(principal_type.eq.${p.principal_type},principal_id.eq."${escapedId}")`;
  });

  const q = await client
    .from('eigen_policy_access_grants')
    .select('principal_type,principal_id,policy_tag,status')
    .eq('status', 'active')
    .or(orClauses.join(','));
  if (q.error) throw new Error(q.error.message);

  const rows = (q.data ?? []) as PolicyGrantRow[];
  return normalizeTags(rows.map((row) => row.policy_tag));
}

export async function resolveEigenxPolicyScope(
  client: SupabaseClient,
  input: ResolveEigenxPolicyScopeInput,
): Promise<ResolveEigenxPolicyScopeResult> {
  const roles = await getUserRoles(input.userId);
  const requested = normalizeTags(
    input.requestedPolicyScope.length > 0 ? input.requestedPolicyScope : input.defaultPolicyScope,
  );

  const principals: Array<{ principal_type: 'user' | 'role'; principal_id: string }> = [
    { principal_type: 'user', principal_id: input.userId },
    ...roles.map((role: CharterRole) => ({ principal_type: 'role' as const, principal_id: role })),
  ];

  const allowedTags = await loadPolicyTagsForPrincipals(client, principals);
  if (allowedTags.length === 0) {
    return {
      effectivePolicyScope: requested,
      grantsConfigured: false,
      allowedPolicyTags: [],
    };
  }

  return {
    effectivePolicyScope: resolveByAllowedTags(requested, allowedTags),
    grantsConfigured: true,
    allowedPolicyTags: allowedTags,
  };
}
