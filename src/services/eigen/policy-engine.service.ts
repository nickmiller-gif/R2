/**
 * Eigen policy engine service.
 *
 * Evaluates capability requests against policy-tag-scoped allow/deny rules
 * and records each evaluation as an append-only decision row when the DB
 * adapter supports it.
 */
import { evaluateEigenPolicyRules } from '../../lib/eigen/eigen-policy-eval.ts';
import { nowUtc } from '../../lib/provenance/clock.js';
import type {
  CreateEigenPolicyRuleInput,
  EigenPolicyDecision,
  EigenPolicyDecisionFilter,
  EigenPolicyRule,
  EigenPolicyRuleFilter,
  EvaluateEigenPolicyInput,
  EvaluateEigenPolicyResult,
} from '../../types/eigen/policy-engine.js';

export {
  evaluateEigenPolicyRules,
  matchWildcard,
  matchesRule,
} from '../../lib/eigen/eigen-policy-eval.ts';

const DEFAULT_DECISION_LIST_LIMIT = 100;
const MAX_DECISION_LIST_LIMIT = 1000;

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

export interface DbEigenPolicyDecisionRow {
  id: string;
  allowed: boolean;
  policy_tags: string[];
  capability_tags: string[];
  caller_roles: string[];
  caller_subject: string | null;
  matched_rule_ids: string[];
  deny_reasons: string[];
  correlation_id: string | null;
  evaluation_ms: number | null;
  metadata: Record<string, unknown>;
  recorded_at: string;
}

export interface EigenPolicyEngineDb {
  insertRule(row: DbEigenPolicyRuleRow): Promise<DbEigenPolicyRuleRow>;
  findRuleById(id: string): Promise<DbEigenPolicyRuleRow | null>;
  queryRules(filter?: EigenPolicyRuleFilter): Promise<DbEigenPolicyRuleRow[]>;
  updateRule(id: string, patch: Partial<DbEigenPolicyRuleRow>): Promise<DbEigenPolicyRuleRow>;
  /** Optional. When provided, evaluate() records each decision and returns its id. */
  insertDecision?(row: DbEigenPolicyDecisionRow): Promise<DbEigenPolicyDecisionRow>;
  /** Optional. Required for listDecisions() reads. */
  queryDecisions?(filter?: EigenPolicyDecisionFilter): Promise<DbEigenPolicyDecisionRow[]>;
}

export interface EigenPolicyEngineService {
  createRule(input: CreateEigenPolicyRuleInput): Promise<EigenPolicyRule>;
  getRuleById(id: string): Promise<EigenPolicyRule | null>;
  listRules(filter?: EigenPolicyRuleFilter): Promise<EigenPolicyRule[]>;
  updateRule(id: string, input: Partial<CreateEigenPolicyRuleInput>): Promise<EigenPolicyRule>;
  evaluate(input: EvaluateEigenPolicyInput): Promise<EvaluateEigenPolicyResult>;
  listDecisions(filter?: EigenPolicyDecisionFilter): Promise<EigenPolicyDecision[]>;
}

export interface CreateEigenPolicyEngineServiceOptions {
  /**
   * Sink for decision-recording errors. Recording failures must not bubble up
   * and break the evaluator's contract — auditing is best-effort.
   * Default: console.warn.
   */
  onRecordError?: (err: unknown) => void;
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

function rowToDecision(row: DbEigenPolicyDecisionRow): EigenPolicyDecision {
  return {
    id: row.id,
    allowed: row.allowed,
    policyTags: row.policy_tags,
    capabilityTags: row.capability_tags,
    callerRoles: row.caller_roles,
    callerSubject: row.caller_subject,
    matchedRuleIds: row.matched_rule_ids,
    denyReasons: row.deny_reasons,
    correlationId: row.correlation_id,
    evaluationMs: row.evaluation_ms,
    metadata: row.metadata,
    recordedAt: new Date(row.recorded_at),
  };
}

export function createEigenPolicyEngineService(
  db: EigenPolicyEngineDb,
  options: CreateEigenPolicyEngineServiceOptions = {},
): EigenPolicyEngineService {
  const onRecordError =
    options.onRecordError ??
    ((err: unknown) => {
      console.warn('[eigen-policy-engine] decision recording failed', err);
    });

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
      const startedAt = Date.now();
      const rules = await this.listRules();
      const result = evaluateEigenPolicyRules(rules, input);
      const evaluationMs = Date.now() - startedAt;

      if (!db.insertDecision) {
        return result;
      }

      const decisionRow: DbEigenPolicyDecisionRow = {
        id: crypto.randomUUID(),
        allowed: result.allowed,
        policy_tags: input.policyTags,
        capability_tags: input.capabilityTags,
        caller_roles: input.callerRoles,
        caller_subject: input.callerSubject ?? null,
        matched_rule_ids: result.matchedRuleIds,
        deny_reasons: result.denyReasons,
        correlation_id: input.correlationId ?? null,
        evaluation_ms: evaluationMs,
        metadata: input.metadata ?? {},
        recorded_at: nowUtc().toISOString(),
      };

      try {
        const inserted = await db.insertDecision(decisionRow);
        return {
          ...result,
          decisionId: inserted.id,
          evaluationMs,
        };
      } catch (err) {
        onRecordError(err);
        return { ...result, evaluationMs };
      }
    },

    async listDecisions(filter) {
      if (!db.queryDecisions) {
        throw new Error(
          'Eigen policy engine DB does not support decision reads; provide queryDecisions to enable listDecisions().',
        );
      }
      // Audit table grows with every Eigen request; cap unbounded scans.
      // Math.max(1, ...) blocks negative/zero values: Postgres treats LIMIT -1
      // as "no limit", which would defeat the cap.
      const requestedLimit = filter?.limit ?? DEFAULT_DECISION_LIST_LIMIT;
      const cappedFilter = {
        ...filter,
        limit: Math.min(Math.max(1, requestedLimit), MAX_DECISION_LIST_LIMIT),
      };
      const rows = await db.queryDecisions(cappedFilter);
      return rows.map(rowToDecision);
    },
  };
}
