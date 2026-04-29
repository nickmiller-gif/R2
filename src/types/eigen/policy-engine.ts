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
  /** Stable caller identifier (e.g. JWT `sub`, service identity). */
  callerSubject?: string;
  /** Per-request correlation id for joining decisions to upstream traces. */
  correlationId?: string;
  /** Free-form annotations stored on the decision row (not on rules). */
  metadata?: Record<string, unknown>;
}

export interface EvaluateEigenPolicyResult {
  allowed: boolean;
  matchedRuleIds: string[];
  denyReasons: string[];
  /** Present only when the service successfully recorded the decision (DB supports it and insertDecision did not throw). */
  decisionId?: string;
  /**
   * Wall-clock ms spent loading rules and running the evaluator (excludes the audit insert).
   * Present whenever the DB supports decision recording — independent of whether the insert succeeded —
   * so callers can use it for evaluator latency telemetry even if recording was best-effort skipped.
   */
  evaluationMs?: number;
}

export interface EigenPolicyDecision {
  id: string;
  allowed: boolean;
  policyTags: string[];
  capabilityTags: string[];
  callerRoles: string[];
  callerSubject: string | null;
  matchedRuleIds: string[];
  denyReasons: string[];
  correlationId: string | null;
  evaluationMs: number | null;
  metadata: Record<string, unknown>;
  recordedAt: Date;
}

export interface EigenPolicyDecisionFilter {
  allowed?: boolean;
  callerSubject?: string;
  correlationId?: string;
  matchedRuleId?: string;
  recordedAfter?: Date;
  recordedBefore?: Date;
  limit?: number;
}
