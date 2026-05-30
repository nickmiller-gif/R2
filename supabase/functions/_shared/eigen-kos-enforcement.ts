/**
 * Shared KOS capability-bundle enforcement for eigen edge functions.
 *
 * Each entrypoint (retrieve, chat, widget-chat, ingest, chat-public) declares
 * its required capability bundle (see EIGEN_KOS_CAPABILITY). Enforcement is
 * all-or-nothing at the endpoint level: if ANY required capability is denied
 * by the policy rules for the caller's effective policy scope + roles, the
 * request is rejected with 403.
 *
 * Semantics:
 *   - `rulesConfigured=false`  → open by default (backwards-compatible while
 *                                policy rules are rolled out per scope).
 *   - `rulesConfigured=true`   → every required capability must appear in
 *                                `allowedCapabilityTags`.
 *
 * This helper is the single place every edge function calls so the behavior
 * (and denial payload shape) is consistent across surfaces. Operators rely
 * on the `denied_capabilities` + `denied_reasons_by_capability` shape for
 * diagnosing 403s.
 *
 * Callers own the CORS decision for the denial response: authenticated
 * endpoints pass `errorResponse` (wildcard CORS); widget surfaces pass
 * `reflectedErrorResponse` bound to the request origin.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Import CharterRole from the pure roles module rather than rbac.ts so this
// helper stays typecheckable by Node tsc (rbac.ts transitively imports Deno
// globals via supabase.ts).
import type { CharterRole } from './roles.ts';
import { resolveEigenCapabilityAccess } from './eigen-policy-engine.ts';
import {
  recordEigenPolicyBundleDecision,
  type EigenPolicyDecisionAuditContext,
} from './eigen-policy-decision-recorder.ts';

export interface EnforceEigenKosCapabilityBundleInput {
  policyTags: string[];
  requiredCapabilityTags: readonly string[];
  callerRoles: CharterRole[];
  /** Identifier used in 403 payloads so clients can correlate the failing endpoint. */
  surface: string;
  /**
   * When provided, the bundle outcome is recorded as one row in
   * `eigen_policy_decisions` for operator audit. Recording is best-effort:
   * a failure is swallowed and logged, never bubbled to the caller, so an
   * audit-table outage cannot break enforcement. Omit to opt out (the
   * rollout backstop while we wire callsites incrementally).
   */
  audit?: EigenPolicyDecisionAuditContext;
}

export interface EigenKosCapabilityDenial {
  surface: string;
  message: string;
  deniedCapabilityTags: string[];
  deniedReasonsByCapability: Record<string, string[]>;
}

export type EnforceEigenKosCapabilityBundleResult =
  | {
      ok: true;
      rulesConfigured: boolean;
      allowedCapabilityTags: string[];
      /** Set when `audit` was provided and recording succeeded. */
      policyDecisionId?: string | null;
    }
  | {
      ok: false;
      denial: EigenKosCapabilityDenial;
      /** Set when `audit` was provided and recording succeeded before denial. */
      policyDecisionId?: string | null;
    };

/**
 * Dedupes + trims input tags before asking the policy engine. Empty bundles
 * short-circuit to `rulesConfigured=false, ok=true` (a surface that declares
 * no required capabilities is trivially allowed).
 */
function normalizeRequiredTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (trimmed) seen.add(trimmed);
  }
  return Array.from(seen);
}

export async function enforceEigenKosCapabilityBundle(
  client: SupabaseClient,
  input: EnforceEigenKosCapabilityBundleInput,
): Promise<EnforceEigenKosCapabilityBundleResult> {
  const capabilityTags = normalizeRequiredTags(input.requiredCapabilityTags);
  if (capabilityTags.length === 0) {
    return { ok: true, rulesConfigured: false, allowedCapabilityTags: [] };
  }

  const startedAt = Date.now();
  const access = await resolveEigenCapabilityAccess(client, {
    policyTags: input.policyTags,
    capabilityTags,
    callerRoles: input.callerRoles,
  });
  const evaluationMs = Date.now() - startedAt;

  // Backwards-compatible: no rules configured for this scope → don't block yet.
  // Once the policy-rule rollout is complete the default can flip to
  // deny-on-missing-rules (tracked as a separate slice).
  if (!access.rulesConfigured) {
    // Skip recording when the rollout backstop fires. There are no rules to
    // attribute the allow to, so a decision row would just be noise — the
    // operator audit story for unconfigured scopes is "no rules yet".
    return {
      ok: true,
      rulesConfigured: false,
      allowedCapabilityTags: access.allowedCapabilityTags,
    };
  }

  const allowed = access.deniedCapabilityTags.length === 0;
  const denyReasons = allowed
    ? []
    : Array.from(
        new Set(
          access.deniedCapabilityTags.flatMap((cap) => access.deniedReasonsByCapability[cap] ?? []),
        ),
      );

  let policyDecisionId: string | null = null;
  if (input.audit) {
    // Await recording so callers can link downstream audit rows (e.g. chat
    // citations → policy_decision_id). The recorder swallows its own errors
    // and returns null on failure, so this await cannot break enforcement.
    policyDecisionId = await recordEigenPolicyBundleDecision(client, {
      allowed,
      policyTags: input.policyTags,
      capabilityTags,
      callerRoles: input.callerRoles,
      matchedRuleIds: access.matchedRuleIds,
      denyReasons,
      evaluationMs,
      audit: input.audit,
      surface: input.surface,
    });
  }

  if (allowed) {
    return {
      ok: true,
      rulesConfigured: true,
      allowedCapabilityTags: access.allowedCapabilityTags,
      policyDecisionId,
    };
  }

  return {
    ok: false,
    denial: {
      surface: input.surface,
      message:
        `KOS capability bundle denied for ${input.surface}: ` +
        access.deniedCapabilityTags.join(', '),
      deniedCapabilityTags: access.deniedCapabilityTags,
      deniedReasonsByCapability: access.deniedReasonsByCapability,
    },
    policyDecisionId,
  };
}

/**
 * Serialize a denial into the stable JSON body clients / operators expect.
 * Callers wrap this in a Response with surface-appropriate CORS headers.
 */
export function buildEigenKosCapabilityDenialBody(
  denial: EigenKosCapabilityDenial,
): Record<string, unknown> {
  return {
    error: denial.message,
    surface: denial.surface,
    denied_capabilities: denial.deniedCapabilityTags,
    denied_reasons_by_capability: denial.deniedReasonsByCapability,
  };
}
