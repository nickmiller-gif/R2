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

// Field-level upper bounds on evaluate() inputs. Mirrored by DB CHECK
// constraints on eigen_policy_decisions so any drift fails closed at the
// storage layer. Generous enough that no real caller hits them; tight
// enough that a misbehaving caller cannot weaponise the audit table.
export const EIGEN_DECISION_BOUNDS = {
  callerSubjectMaxLength: 256,
  correlationIdMaxLength: 128,
  policyTagsMax: 32,
  policyTagMaxLength: 128,
  capabilityTagsMax: 64,
  capabilityTagMaxLength: 128,
  callerRolesMax: 16,
  callerRoleMaxLength: 64,
  metadataMaxJsonBytes: 4 * 1024,
} as const;

function jsonByteLength(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value) ?? '').length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function assertStringArrayBounds(
  field: string,
  values: readonly string[],
  maxCardinality: number,
  maxElementLength: number,
): void {
  if (values.length > maxCardinality) {
    throw new Error(
      `evaluate(): ${field} cardinality ${values.length} exceeds max ${maxCardinality}`,
    );
  }
  for (const v of values) {
    if (typeof v !== 'string') {
      throw new Error(`evaluate(): ${field} entries must be strings`);
    }
    if (v.length > maxElementLength) {
      throw new Error(
        `evaluate(): ${field} entry length ${v.length} exceeds max ${maxElementLength}`,
      );
    }
  }
}

function assertEvaluateInputBounds(input: EvaluateEigenPolicyInput): void {
  assertStringArrayBounds(
    'policyTags',
    input.policyTags,
    EIGEN_DECISION_BOUNDS.policyTagsMax,
    EIGEN_DECISION_BOUNDS.policyTagMaxLength,
  );
  assertStringArrayBounds(
    'capabilityTags',
    input.capabilityTags,
    EIGEN_DECISION_BOUNDS.capabilityTagsMax,
    EIGEN_DECISION_BOUNDS.capabilityTagMaxLength,
  );
  assertStringArrayBounds(
    'callerRoles',
    input.callerRoles,
    EIGEN_DECISION_BOUNDS.callerRolesMax,
    EIGEN_DECISION_BOUNDS.callerRoleMaxLength,
  );
  if (
    input.callerSubject !== undefined &&
    input.callerSubject.length > EIGEN_DECISION_BOUNDS.callerSubjectMaxLength
  ) {
    throw new Error(
      `evaluate(): callerSubject length ${input.callerSubject.length} exceeds max ${EIGEN_DECISION_BOUNDS.callerSubjectMaxLength}`,
    );
  }
  if (
    input.correlationId !== undefined &&
    input.correlationId.length > EIGEN_DECISION_BOUNDS.correlationIdMaxLength
  ) {
    throw new Error(
      `evaluate(): correlationId length ${input.correlationId.length} exceeds max ${EIGEN_DECISION_BOUNDS.correlationIdMaxLength}`,
    );
  }
  if (input.metadata !== undefined) {
    const bytes = jsonByteLength(input.metadata);
    if (bytes > EIGEN_DECISION_BOUNDS.metadataMaxJsonBytes) {
      throw new Error(
        `evaluate(): metadata JSON byte length ${bytes} exceeds max ${EIGEN_DECISION_BOUNDS.metadataMaxJsonBytes}`,
      );
    }
  }
}

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
      assertEvaluateInputBounds(input);
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
