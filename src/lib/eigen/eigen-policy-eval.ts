/**
 * Pure Eigen/KOS policy evaluation (wildcard patterns, role hierarchy, deny-over-allow).
 * Shared by Node services and Deno edge functions.
 */
import {
  EIGEN_POLICY_RULE_LIMITS,
  type EigenPolicyRule,
  type EvaluateEigenPolicyInput,
  type EvaluateEigenPolicyResult,
} from '../../types/eigen/policy-engine.ts';
import { ROLE_HIERARCHY } from '../../types/shared/roles.ts';

export interface NormalizedPolicyRuleInput {
  policyTag: string;
  capabilityTagPattern: string;
  rationale: string | null;
  metadata: Record<string, unknown>;
}

export interface NormalizePolicyRuleInput {
  policyTag?: string | null;
  capabilityTagPattern?: string | null;
  rationale?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class EigenPolicyRuleValidationError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = 'EigenPolicyRuleValidationError';
    this.field = field;
  }
}

function requireNonEmptyString(
  field: string,
  value: string | null | undefined,
  maxLength: number,
): string {
  if (typeof value !== 'string') {
    throw new EigenPolicyRuleValidationError(field, `${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new EigenPolicyRuleValidationError(field, `${field} must not be empty`);
  }
  if (trimmed.length > maxLength) {
    throw new EigenPolicyRuleValidationError(
      field,
      `${field} exceeds maximum length of ${maxLength}`,
    );
  }
  return trimmed;
}

function normalizeOptionalText(
  field: string,
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new EigenPolicyRuleValidationError(field, `${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) {
    throw new EigenPolicyRuleValidationError(
      field,
      `${field} exceeds maximum length of ${maxLength}`,
    );
  }
  return trimmed;
}

function normalizeMetadata(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new EigenPolicyRuleValidationError('metadata', 'metadata must be a JSON object');
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new EigenPolicyRuleValidationError('metadata', 'metadata must be JSON-serializable');
  }
  if (serialized.length > EIGEN_POLICY_RULE_LIMITS.METADATA_BYTES_MAX) {
    throw new EigenPolicyRuleValidationError(
      'metadata',
      `metadata exceeds maximum size of ${EIGEN_POLICY_RULE_LIMITS.METADATA_BYTES_MAX} bytes`,
    );
  }
  return value;
}

/**
 * Trim + length-check user-supplied rule fields before they reach the DB.
 * Mirrors the CHECK constraints on eigen_policy_rules and normalizes empty
 * optionals to null so callers don't have to branch on " " vs "".
 */
export function normalizePolicyRuleInput(
  input: NormalizePolicyRuleInput,
): NormalizedPolicyRuleInput {
  return {
    policyTag: requireNonEmptyString(
      'policy_tag',
      input.policyTag,
      EIGEN_POLICY_RULE_LIMITS.POLICY_TAG_MAX,
    ),
    capabilityTagPattern: requireNonEmptyString(
      'capability_tag_pattern',
      input.capabilityTagPattern,
      EIGEN_POLICY_RULE_LIMITS.CAPABILITY_TAG_PATTERN_MAX,
    ),
    rationale: normalizeOptionalText(
      'rationale',
      input.rationale,
      EIGEN_POLICY_RULE_LIMITS.RATIONALE_MAX,
    ),
    metadata: normalizeMetadata(input.metadata),
  };
}

/**
 * Variant for PATCH-style partial updates: only fields present in `input` are
 * normalized and returned; undefined fields are omitted. Null rationale/metadata
 * are passed through intentionally so callers can clear them.
 */
export function normalizePolicyRulePatch(
  input: NormalizePolicyRuleInput,
): Partial<NormalizedPolicyRuleInput> {
  const patch: Partial<NormalizedPolicyRuleInput> = {};
  if (input.policyTag !== undefined) {
    patch.policyTag = requireNonEmptyString(
      'policy_tag',
      input.policyTag,
      EIGEN_POLICY_RULE_LIMITS.POLICY_TAG_MAX,
    );
  }
  if (input.capabilityTagPattern !== undefined) {
    patch.capabilityTagPattern = requireNonEmptyString(
      'capability_tag_pattern',
      input.capabilityTagPattern,
      EIGEN_POLICY_RULE_LIMITS.CAPABILITY_TAG_PATTERN_MAX,
    );
  }
  if (input.rationale !== undefined) {
    patch.rationale = normalizeOptionalText(
      'rationale',
      input.rationale,
      EIGEN_POLICY_RULE_LIMITS.RATIONALE_MAX,
    );
  }
  if (input.metadata !== undefined) {
    patch.metadata = normalizeMetadata(input.metadata);
  }
  return patch;
}

type HierarchicalRole = (typeof ROLE_HIERARCHY)[number];
const WILDCARD_REGEX_CACHE_MAX_SIZE = 1024;
const wildcardRegexCache = new Map<string, RegExp>();

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

export function matchWildcard(pattern: string, value: string): boolean {
  if (pattern === '*') return true;
  if (!pattern.includes('*')) return pattern === value;
  const regex = wildcardRegexCache.get(pattern);
  if (regex) {
    wildcardRegexCache.delete(pattern);
    wildcardRegexCache.set(pattern, regex);
    return regex.test(value);
  }
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const compiled = new RegExp(`^${escaped}$`);
  if (wildcardRegexCache.size >= WILDCARD_REGEX_CACHE_MAX_SIZE) {
    const oldest = wildcardRegexCache.keys().next().value;
    if (oldest) wildcardRegexCache.delete(oldest);
  }
  wildcardRegexCache.set(pattern, compiled);
  return compiled.test(value);
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
