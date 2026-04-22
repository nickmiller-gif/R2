/**
 * Eigen policy engine service.
 *
 * Evaluates capability requests against policy-tag-scoped allow/deny rules.
 */
import {
  evaluateEigenPolicyRules,
  normalizePolicyRuleInput,
  normalizePolicyRulePatch,
} from '../../lib/eigen/eigen-policy-eval.ts';
import { nowUtc } from '../../lib/provenance/clock.js';
import type {
  CreateEigenPolicyRuleInput,
  EigenPolicyRule,
  EigenPolicyRuleFilter,
  EvaluateEigenPolicyInput,
  EvaluateEigenPolicyResult,
} from '../../types/eigen/policy-engine.js';

export {
  EigenPolicyRuleValidationError,
  evaluateEigenPolicyRules,
  matchWildcard,
  matchesRule,
  normalizePolicyRuleInput,
  normalizePolicyRulePatch,
} from '../../lib/eigen/eigen-policy-eval.ts';

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

export function createEigenPolicyEngineService(db: EigenPolicyEngineDb): EigenPolicyEngineService {
  return {
    async createRule(input) {
      const normalized = normalizePolicyRuleInput({
        policyTag: input.policyTag,
        capabilityTagPattern: input.capabilityTagPattern,
        rationale: input.rationale ?? null,
        metadata: input.metadata ?? {},
      });
      const now = nowUtc().toISOString();
      const row = await db.insertRule({
        id: crypto.randomUUID(),
        policy_tag: normalized.policyTag,
        capability_tag_pattern: normalized.capabilityTagPattern,
        effect: input.effect,
        required_role: input.requiredRole ?? null,
        rationale: normalized.rationale,
        metadata: normalized.metadata,
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
      const normalized = normalizePolicyRulePatch({
        policyTag: input.policyTag,
        capabilityTagPattern: input.capabilityTagPattern,
        rationale: input.rationale,
        metadata: input.metadata,
      });
      const patch: Partial<DbEigenPolicyRuleRow> = {
        updated_at: nowUtc().toISOString(),
      };
      if (normalized.policyTag !== undefined) patch.policy_tag = normalized.policyTag;
      if (normalized.capabilityTagPattern !== undefined) {
        patch.capability_tag_pattern = normalized.capabilityTagPattern;
      }
      if (input.effect !== undefined) patch.effect = input.effect;
      if (input.requiredRole !== undefined) patch.required_role = input.requiredRole;
      if (input.rationale !== undefined) patch.rationale = normalized.rationale ?? null;
      if (input.metadata !== undefined) patch.metadata = normalized.metadata ?? {};
      const row = await db.updateRule(id, patch);
      return rowToRule(row);
    },

    async evaluate(input) {
      const rules = await this.listRules();
      return evaluateEigenPolicyRules(rules, input);
    },
  };
}
