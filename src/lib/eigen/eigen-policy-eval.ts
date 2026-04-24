/**
 * Pure Eigen/KOS policy evaluation (wildcard patterns, role hierarchy, deny-over-allow).
 * Shared by Node services and Deno edge functions.
 */
import type {
  EigenPolicyRule,
  EvaluateEigenPolicyInput,
  EvaluateEigenPolicyResult,
} from '../../types/eigen/policy-engine.ts';
import { ROLE_HIERARCHY } from '../../types/shared/roles.ts';

type HierarchicalRole = (typeof ROLE_HIERARCHY)[number];

function isHierarchicalRole(value: string): value is HierarchicalRole {
  return (ROLE_HIERARCHY as readonly string[]).includes(value);
}

export function hasRequiredRole(callerRoles: string[], requiredRole: string | null): boolean {
  if (!requiredRole) return true;
  if (callerRoles.includes(requiredRole)) return true;
  if (!isHierarchicalRole(requiredRole)) return false;
  const minimumIndex = ROLE_HIERARCHY.indexOf(requiredRole);
  return callerRoles.some(
    (role) => isHierarchicalRole(role) && ROLE_HIERARCHY.indexOf(role) >= minimumIndex,
  );
}

/**
 * Linear-time glob matcher using two-pointer with single-level backtracking.
 *
 * Rules are loaded on the hot path of every Eigen request (eigen-chat,
 * eigen-retrieve, eigen-ingest, eigen-tool-capabilities), and
 * `capability_tag_pattern` / `policy_tag` are operator-writable. The prior
 * regex-based form (`*` → `.*` + `new RegExp`) was susceptible to
 * catastrophic backtracking on patterns like `a*a*a*a*a*!` — a single
 * malicious rule could degrade the whole Eigen surface. This implementation
 * runs in O(m·n) with linear constant and cannot ReDoS regardless of the
 * operator's pattern. Regex metacharacters in the pattern are treated
 * literally (the old matcher escaped them, so behaviour is preserved).
 */
export function matchWildcard(pattern: string, value: string): boolean {
  let pi = 0;
  let vi = 0;
  let starPi = -1;
  let starVi = -1;
  while (vi < value.length) {
    if (pi < pattern.length && pattern[pi] === value[vi]) {
      pi++;
      vi++;
    } else if (pi < pattern.length && pattern[pi] === '*') {
      starPi = pi;
      starVi = vi;
      pi++;
    } else if (starPi !== -1) {
      pi = starPi + 1;
      starVi++;
      vi = starVi;
    } else {
      return false;
    }
  }
  while (pi < pattern.length && pattern[pi] === '*') pi++;
  return pi === pattern.length;
}

export function matchesRule(rule: EigenPolicyRule, input: EvaluateEigenPolicyInput): boolean {
  const policyTagMatch = input.policyTags.some((tag) => matchWildcard(rule.policyTag, tag));
  if (!policyTagMatch) return false;
  const capabilityTagMatch = input.capabilityTags.some((tag) =>
    matchWildcard(rule.capabilityTagPattern, tag),
  );
  if (!capabilityTagMatch) return false;
  if (!hasRequiredRole(input.callerRoles, rule.requiredRole)) return false;
  return true;
}

export function evaluateEigenPolicyRules(
  rules: EigenPolicyRule[],
  input: EvaluateEigenPolicyInput,
): EvaluateEigenPolicyResult {
  const matching = rules.filter((rule) => matchesRule(rule, input));
  const denying = matching.filter((rule) => rule.effect === 'deny');
  if (denying.length > 0) {
    return {
      allowed: false,
      matchedRuleIds: matching.map((r) => r.id),
      denyReasons: denying.map((r) => r.rationale ?? `Denied by ${r.id}`),
    };
  }
  const allowing = matching.filter((rule) => rule.effect === 'allow');
  return {
    allowed: allowing.length > 0,
    matchedRuleIds: matching.map((r) => r.id),
    denyReasons: allowing.length > 0 ? [] : ['No matching allow rule'],
  };
}

function normalizeCapabilityTags(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

/**
 * Rules must already satisfy policy-tag and role constraints for `policyTags` and `callerRoles`.
 */
function evaluateSubsetForCapability(
  rules: EigenPolicyRule[],
  capabilityTag: string,
): { allowed: boolean; denyReasons: string[] } {
  const matching = rules.filter((rule) => matchWildcard(rule.capabilityTagPattern, capabilityTag));
  const denying = matching.filter((rule) => rule.effect === 'deny');
  if (denying.length > 0) {
    return { allowed: false, denyReasons: denying.map((r) => r.rationale ?? `Denied by ${r.id}`) };
  }
  const allowing = matching.filter((rule) => rule.effect === 'allow');
  return {
    allowed: allowing.length > 0,
    denyReasons: allowing.length > 0 ? [] : ['No matching allow rule'],
  };
}

export interface EvaluateEigenPolicyPerCapabilityResult {
  allowedCapabilityTags: string[];
  deniedCapabilityTags: string[];
  deniedReasonsByCapability: Record<string, string[]>;
}

/**
 * One pass over rules: pre-filter by policy tags and roles, then evaluate each capability
 * against capability patterns only (equivalent to looping evaluateEigenPolicyRules per tag).
 */
export function evaluateEigenPolicyRulesPerCapability(
  rules: EigenPolicyRule[],
  policyTags: string[],
  capabilityTags: string[],
  callerRoles: string[],
): EvaluateEigenPolicyPerCapabilityResult {
  const caps = normalizeCapabilityTags(capabilityTags);
  if (caps.length === 0) {
    return { allowedCapabilityTags: [], deniedCapabilityTags: [], deniedReasonsByCapability: {} };
  }

  const policyNorm = Array.from(new Set(policyTags.map((t) => t.trim()).filter(Boolean)));
  const candidates = rules.filter(
    (rule) =>
      policyNorm.some((tag) => matchWildcard(rule.policyTag, tag)) &&
      hasRequiredRole(callerRoles, rule.requiredRole),
  );

  const allowedCapabilityTags: string[] = [];
  const deniedCapabilityTags: string[] = [];
  const deniedReasonsByCapability: Record<string, string[]> = {};

  for (const capabilityTag of caps) {
    const evaluation = evaluateSubsetForCapability(candidates, capabilityTag);
    if (evaluation.allowed) {
      allowedCapabilityTags.push(capabilityTag);
    } else {
      deniedCapabilityTags.push(capabilityTag);
      deniedReasonsByCapability[capabilityTag] = evaluation.denyReasons;
    }
  }

  return {
    allowedCapabilityTags,
    deniedCapabilityTags,
    deniedReasonsByCapability,
  };
}
