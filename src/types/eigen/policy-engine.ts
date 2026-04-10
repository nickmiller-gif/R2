/**
 * Eigen policy engine types for capability-aware enforcement.
 */

export type EigenPolicyEffect = 'allow' | 'deny';

export interface EigenPolicyRule {
  id: string;
  policyTag: string;
  capabilityTagPattern: string;
  effect: EigenPolicyEffect;
  requiredRole: string | null;
  rationale: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEigenPolicyRuleInput {
  policyTag: string;
  capabilityTagPattern: string;
  effect: EigenPolicyEffect;
  requiredRole?: string | null;
  rationale?: string | null;
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

