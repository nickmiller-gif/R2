import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { executeEigenRetrieve, parseEigenRetrieveRequest } from '../_shared/eigen-retrieve-core.ts';
import { resolveEffectiveEigenxScope } from '../_shared/eigenx-scope-resolver.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import {
  buildEigenKosCapabilityDenialBody,
  enforceEigenKosCapabilityBundle,
} from '../_shared/eigen-kos-enforcement.ts';
import { EIGEN_KOS_CAPABILITY } from '../../../src/lib/eigen/eigen-kos-capabilities.ts';

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    const roleCheck = await requireRole(auth.claims.userId, 'member');
    if (!roleCheck.ok) return roleCheck.response;

    try {
      const client = getServiceClient();
      let payload = parseEigenRetrieveRequest(await req.json());
      const resolvedScope = await resolveEffectiveEigenxScope({
        client,
        userId: auth.claims.userId,
        roles: roleCheck.roles,
        explicitScope: payload.policy_scope,
      });
      if (resolvedScope.emptyAfterGrantIntersection) {
        return errorResponse('No private policy scope access for this user', 403);
      }
      payload = { ...payload, policy_scope: resolvedScope.effectivePolicyScope };

      // Enforce the retrieve KOS capability bundle (search + read:knowledge) for the
      // caller's effective policy scope. rulesConfigured=false short-circuits to allow
      // so scopes without policy rules keep working during the rollout.
      const kos = await enforceEigenKosCapabilityBundle(client, {
        policyTags: resolvedScope.effectivePolicyScope,
        requiredCapabilityTags: EIGEN_KOS_CAPABILITY.retrieve,
        callerRoles: roleCheck.roles,
        surface: 'eigen-retrieve',
      });
      if (!kos.ok) {
        return new Response(JSON.stringify(buildEigenKosCapabilityDenialBody(kos.denial)), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await executeEigenRetrieve(client, payload);
      if (!result.ok) return errorResponse(result.message, result.status);
      return jsonResponse(result.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return errorResponse(message, 500);
    }
  }),
);
