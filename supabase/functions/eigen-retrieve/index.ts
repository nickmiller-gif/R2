import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import {
  executeEigenRetrieve,
  parseEigenRetrieveRequest,
} from '../_shared/eigen-retrieve-core.ts';
import { resolveEigenxPolicyScope } from '../_shared/eigen-policy-access.ts';
import {
  clampExplicitEigenxPolicyScope,
  defaultEigenxRetrievePolicyScope,
  readEigenxEnvDefaultPolicyScope,
} from '../_shared/eigenx-scope.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  const roleCheck = await requireRole(auth.claims.userId, 'member');
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const client = getServiceClient();
    let payload = parseEigenRetrieveRequest(await req.json());
    const explicit = (payload.policy_scope?.length ?? 0) > 0;
    const preScope = explicit
      ? clampExplicitEigenxPolicyScope(auth.claims.userId, roleCheck.roles, payload.policy_scope)
      : defaultEigenxRetrievePolicyScope(auth.claims.userId, roleCheck.roles);
    const resolvedScope = await resolveEigenxPolicyScope(client, {
      userId: auth.claims.userId,
      requestedPolicyScope: preScope,
      defaultPolicyScope: readEigenxEnvDefaultPolicyScope(),
    });
    if (resolvedScope.grantsConfigured && resolvedScope.effectivePolicyScope.length === 0) {
      return errorResponse('No private policy scope access for this user', 403);
    }
    payload = { ...payload, policy_scope: resolvedScope.effectivePolicyScope };
    const result = await executeEigenRetrieve(client, payload);
    if (!result.ok) return errorResponse(result.message, result.status);
    return jsonResponse(result.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
