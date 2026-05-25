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
  withRequestMeta(async (req, meta) => {
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    const roleCheck = await requireRole(auth.claims.userId, 'member');
    if (!roleCheck.ok) return roleCheck.response;

    try {
      const client = getServiceClient();
      const rawBody = await req.json();
      // Caller can either omit `policy_scope` (resolver fills it from grants)
      // or pass it explicitly. The audit row preserves that distinction so
      // operators can tell intent-scoped retrieves from defaulted ones.
      const policyScopeExplicit =
        !!rawBody && typeof rawBody === 'object' && 'policy_scope' in rawBody;
      let payload = parseEigenRetrieveRequest(rawBody);
      const resolvedScope = await resolveEffectiveEigenxScope({
        client,
        userId: auth.claims.userId,
        roles: roleCheck.roles,
        explicitScope: policyScopeExplicit ? payload.policy_scope : undefined,
      });
      if (resolvedScope.emptyAfterGrantIntersection) {
        return errorResponse('No private policy scope access for this user', 403);
      }
      payload = { ...payload, policy_scope: resolvedScope.effectivePolicyScope };

      // Enforce the retrieve KOS capability bundle (search + read:knowledge) for the
      // caller's effective policy scope. rulesConfigured=false short-circuits to allow
      // so scopes without policy rules keep working during the rollout.
      // Opt into decision-audit recording so the retrieve surface lands rows in
      // `eigen_policy_decisions` for operator review — matches the chat surface
      // wire-up landed in #297. Recording is best-effort inside the helper.
      const kos = await enforceEigenKosCapabilityBundle(client, {
        policyTags: resolvedScope.effectivePolicyScope,
        requiredCapabilityTags: EIGEN_KOS_CAPABILITY.retrieve,
        callerRoles: roleCheck.roles,
        surface: 'eigen-retrieve',
        audit: {
          callerSubject: auth.claims.userId,
          correlationId: meta.correlationId,
          metadata: {
            policy_scope_explicit: policyScopeExplicit,
            site_provided: typeof payload.site_id === 'string' && payload.site_id.length > 0,
            entity_scope_size: payload.entity_scope?.length ?? 0,
            outside_domain_intent: payload.outside_domain_intent === true,
          },
        },
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
