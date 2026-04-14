import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveEigenxPolicyScope } from './eigen-policy-access.ts';
import {
  clampExplicitEigenxPolicyScope,
  defaultEigenxRetrievePolicyScope,
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
}

export async function resolveEffectiveEigenxScope(
  input: ResolveEffectiveEigenxScopeInput,
): Promise<ResolveEffectiveEigenxScopeResult> {
  const roles = input.roles ?? await getUserRoles(input.userId);
  const explicitScope = input.explicitScope ?? [];
  const isExplicit = explicitScope.length > 0;

  const requestedPolicyScope = isExplicit
    ? clampExplicitEigenxPolicyScope(input.userId, roles, explicitScope)
    : defaultEigenxRetrievePolicyScope(input.userId, roles);

  const resolved = await resolveEigenxPolicyScope(input.client, {
    userId: input.userId,
    requestedPolicyScope,
    defaultPolicyScope: readEigenxEnvDefaultPolicyScope(),
  });

  return {
    effectivePolicyScope: resolved.effectivePolicyScope,
    grantsConfigured: resolved.grantsConfigured,
    emptyAfterGrantIntersection: resolved.grantsConfigured && resolved.effectivePolicyScope.length === 0,
    resolutionMode: isExplicit ? 'explicit-clamped' : 'default',
  };
}
