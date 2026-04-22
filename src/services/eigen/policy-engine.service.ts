/**
 * Eigen policy engine service.
 *
 * Evaluates capability requests against policy-tag-scoped allow/deny rules.
 */
import { nowUtc } from '../../lib/provenance/clock.js';
import type {
  CreateEigenPolicyRuleInput,
  EigenPolicyRule,
  EigenPolicyRuleFilter,
  EvaluateEigenPolicyInput,
  EvaluateEigenPolicyResult,
} from '../../types/eigen/policy-engine.js';
import { ROLE_HIERARCHY } from '../../types/shared/roles.js';

export interface DbEigenPolicyRuleRow {
  id: string;
  policy_tag: string;
  capability_tag_pattern: string;
  effect: 'allow' | 'deny';
  required_role: string | null;
  rationale: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EigenPolicyEngineDb {
  insertRule(row: DbEigenPolicyRuleRow): Promise<DbEigenPolicyRuleRow>;
  findRuleById(id: string): Promise<DbEigenPolicyRuleRow | null>;
  queryRules(filter?: EigenPolicyRuleFilter): Promise<DbEigenPolicyRuleRow[]>;
  updateRule(id: string, patch: Partial<DbEigenPolicyRuleRow>): Promise<DbEigenPolicyRuleRow>;
}

export interface EigenPolicyEngineService {
  createRule(input: CreateEigenPolicyRuleInput): Promise<EigenPolicyRule>;
  getRuleById(id: string): Promise<EigenPolicyRule | null>;
  listRules(filter?: EigenPolicyRuleFilter): Promise<EigenPolicyRule[]>;
  updateRule(id: string, input: Partial<CreateEigenPolicyRuleInput>): Promise<EigenPolicyRule>;
  evaluate(input: EvaluateEigenPolicyInput): Promise<EvaluateEigenPolicyResult>;
}

function rowToRule(row: DbEigenPolicyRuleRow): EigenPolicyRule {
  return {
    id: row.id,
    policyTag: row.policy_tag,
    capabilityTagPattern: row.capability_tag_pattern,
    effect: row.effect,
    requiredRole: row.required_role,
    rationale: row.rationale,
    metadata: row.metadata ?? {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

type HierarchicalRole = (typeof ROLE_HIERARCHY)[number];

function isHierarchicalRole(value: string): value is HierarchicalRole {
  return (ROLE_HIERARCHY as readonly string[]).includes(value);
}

function hasRequiredRole(callerRoles: string[], requiredRole: string | null): boolean {
  if (!requiredRole) return true;
  if (callerRoles.includes(requiredRole)) return true;
  if (!isHierarchicalRole(requiredRole)) return false;
  const minimumIndex = ROLE_HIERARCHY.indexOf(requiredRole);
  return callerRoles.some((role) =>
    isHierarchicalRole(role) && ROLE_HIERARCHY.indexOf(role) >= minimumIndex,
  );
}

// Linear-time glob matcher. Only `*` is special (matches zero-or-more chars).
// Uses two-pointer with single-level backtracking, so it cannot exhibit
// catastrophic backtracking the way a regex with `.*` can — this matters
// because `capability_tag_pattern` is operator-writable and the matcher runs
// on the hot path of every Eigen request.
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

export function createEigenPolicyEngineService(db: EigenPolicyEngineDb): EigenPolicyEngineService {
  return {
    async createRule(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertRule({
        id: crypto.randomUUID(),
        policy_tag: input.policyTag,
        capability_tag_pattern: input.capabilityTagPattern,
        effect: input.effect,
        required_role: input.requiredRole ?? null,
        rationale: input.rationale ?? null,
        metadata: input.metadata ?? {},
        created_at: now,
        updated_at: now,
      });
      return rowToRule(row);
    },

    async getRuleById(id) {
      const row = await db.findRuleById(id);
      return row ? rowToRule(row) : null;
    },

    async listRules(filter) {
      const rows = await db.queryRules(filter);
      return rows.map(rowToRule);
    },

    async updateRule(id, input) {
      const patch: Partial<DbEigenPolicyRuleRow> = {
        updated_at: nowUtc().toISOString(),
      };
      if (input.policyTag !== undefined) patch.policy_tag = input.policyTag;
      if (input.capabilityTagPattern !== undefined) {
        patch.capability_tag_pattern = input.capabilityTagPattern;
      }
      if (input.effect !== undefined) patch.effect = input.effect;
      if (input.requiredRole !== undefined) patch.required_role = input.requiredRole;
      if (input.rationale !== undefined) patch.rationale = input.rationale;
      if (input.metadata !== undefined) patch.metadata = input.metadata;
      const row = await db.updateRule(id, patch);
      return rowToRule(row);
    },

    async evaluate(input) {
      const rules = await this.listRules();
      return evaluateEigenPolicyRules(rules, input);
    },
  };
}

