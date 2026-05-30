import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadActiveGroupIdsForUser } from './eigen-access-groups.ts';
import { resolveEigenxPolicyScope } from './eigen-policy-access.ts';
import {
  clampExplicitEigenxPolicyScope,
  defaultEigenxRetrievePolicyScope,
  hasFullEigenxAccess,
  readEigenxEnvDefaultPolicyScope,
} from './eigenx-scope.ts';
import { getUserRoles, type CharterRole } from './rbac.ts';

interface ResolveEffectiveEigenxScopeInput {
  client: SupabaseClient;
  userId: string;
  roles?: CharterRole[];
  explicitScope?: string[];
}

export interface ResolveEffectiveEigenxScopeResult {
  effectivePolicyScope: string[];
  grantsConfigured: boolean;
  emptyAfterGrantIntersection: boolean;
  resolutionMode: 'explicit-clamped' | 'default';
  groupIds: string[];
}

export async function resolveEffectiveEigenxScope(
  input: ResolveEffectiveEigenxScopeInput,
): Promise<ResolveEffectiveEigenxScopeResult> {
  const roles = input.roles ?? (await getUserRoles(input.userId));
  const explicitScope = input.explicitScope ?? [];
  const isExplicit = explicitScope.length > 0;

  const groupIds = hasFullEigenxAccess(roles)
    ? []
    : await loadActiveGroupIdsForUser(input.client, input.userId);

  const requestedPolicyScope = isExplicit
    ? clampExplicitEigenxPolicyScope(input.userId, roles, explicitScope, groupIds)
    : defaultEigenxRetrievePolicyScope(input.userId, roles, groupIds);

  const resolved = await resolveEigenxPolicyScope(input.client, {
    userId: input.userId,
    requestedPolicyScope,
    defaultPolicyScope: readEigenxEnvDefaultPolicyScope(),
  });

  return {
    effectivePolicyScope: resolved.effectivePolicyScope,
    grantsConfigured: resolved.grantsConfigured,
    emptyAfterGrantIntersection:
      resolved.grantsConfigured && resolved.effectivePolicyScope.length === 0,
    resolutionMode: isExplicit ? 'explicit-clamped' : 'default',
    groupIds,
  };
}
