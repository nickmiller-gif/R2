/**
 * Eigen policy engine types for capability-aware enforcement.
 */

export type EigenPolicyEffect = 'allow' | 'deny';

/**
 * Bounds mirrored by the `eigen_policy_rules_*` CHECK constraints
 * (see migration 202604240003). Callers and services validate against these
 * so the DB only ever sees already-shaped input.
 */
export const EIGEN_POLICY_RULE_LIMITS = {
  POLICY_TAG_MAX: 256,
  CAPABILITY_TAG_PATTERN_MAX: 512,
  RATIONALE_MAX: 2048,
  METADATA_BYTES_MAX: 8192,
} as const;

export interface EigenPolicyRule {
  id: string;
  policyTag: string;
  capabilityTagPattern: string;
  effect: EigenPolicyEffect;
  requiredRole: string | null;
  rationale: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEigenPolicyRuleInput {
  policyTag: string;
  capabilityTagPattern: string;
  effect: EigenPolicyEffect;
  requiredRole?: string | null;
  rationale?: string | null;
  metadata?: Record<string, unknown>;
}

export interface EigenPolicyRuleFilter {
  policyTag?: string;
  effect?: EigenPolicyEffect;
}

export interface EvaluateEigenPolicyInput {
  policyTags: string[];
  capabilityTags: string[];
  callerRoles: string[];
}

export interface EvaluateEigenPolicyResult {
  allowed: boolean;
  matchedRuleIds: string[];
  denyReasons: string[];
}

