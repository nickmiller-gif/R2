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

// Audit-write bounds for eigen_policy_decisions. evaluate() persists every
// call, so unbounded caller fields would inflate the audit table and degrade
// operator audit reads. Truncate at record time rather than failing the
// evaluation: auditing is best-effort (the eval result must still flow back),
// and pathological inputs are bugs in upstream callers, not user data.
// Keep in sync with DB CHECK constraints in
// supabase/migrations/202604300001_eigen_policy_decisions_input_bounds.sql.
const MAX_DECISION_TAG_ARRAY_LEN = 32;
const MAX_DECISION_TAG_LEN = 256;
const MAX_DECISION_ROLE_ARRAY_LEN = 16;
const MAX_DECISION_ROLE_LEN = 64;
const MAX_DECISION_SUBJECT_LEN = 256;
const MAX_DECISION_CORRELATION_LEN = 128;
const MAX_DECISION_MATCHED_RULES = 256;
const MAX_DECISION_DENY_REASONS = 256;
const MAX_DECISION_DENY_REASON_LEN = 2048;
const MAX_DECISION_METADATA_BYTES = 8192;
const TRUNCATION_MARKER_KEY = '__decision_truncations';

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

type DecisionTruncations = Record<string, number | true>;

function clampStringArray(
  values: string[],
  maxArray: number,
  maxString: number,
): { values: string[]; arrayDropped: number; stringsClamped: number } {
  const arrayDropped = values.length > maxArray ? values.length - maxArray : 0;
  const sliced = arrayDropped > 0 ? values.slice(0, maxArray) : values;
  let stringsClamped = 0;
  const out = sliced.map((value) => {
    if (typeof value !== 'string') return String(value);
    if (value.length <= maxString) return value;
    stringsClamped++;
    return value.slice(0, maxString);
  });
  return { values: out, arrayDropped, stringsClamped };
}

function clampString(value: string, maxLen: number): { value: string; clamped: boolean } {
  if (value.length <= maxLen) return { value, clamped: false };
  return { value: value.slice(0, maxLen), clamped: true };
}

function metadataBytes(value: Record<string, unknown>): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * Bounds caller-supplied + evaluator-derived fields before they hit the audit
 * table. Truncates rather than throws so the evaluator contract holds (eval
 * result still flows back). Truncations are recorded in `metadata.{TRUNCATION_MARKER_KEY}`
 * so operators reading the audit table can see what was cut.
 */
function boundDecisionRow(
  rawInput: EvaluateEigenPolicyInput,
  result: EvaluateEigenPolicyResult,
): {
  policyTags: string[];
  capabilityTags: string[];
  callerRoles: string[];
  callerSubject: string | null;
  correlationId: string | null;
  matchedRuleIds: string[];
  denyReasons: string[];
  metadata: Record<string, unknown>;
} {
  const truncations: DecisionTruncations = {};

  const policyTags = clampStringArray(
    rawInput.policyTags,
    MAX_DECISION_TAG_ARRAY_LEN,
    MAX_DECISION_TAG_LEN,
  );
  if (policyTags.arrayDropped) truncations.policy_tags_dropped = policyTags.arrayDropped;
  if (policyTags.stringsClamped) truncations.policy_tags_clamped = policyTags.stringsClamped;

  const capabilityTags = clampStringArray(
    rawInput.capabilityTags,
    MAX_DECISION_TAG_ARRAY_LEN,
    MAX_DECISION_TAG_LEN,
  );
  if (capabilityTags.arrayDropped) {
    truncations.capability_tags_dropped = capabilityTags.arrayDropped;
  }
  if (capabilityTags.stringsClamped) {
    truncations.capability_tags_clamped = capabilityTags.stringsClamped;
  }

  const callerRoles = clampStringArray(
    rawInput.callerRoles,
    MAX_DECISION_ROLE_ARRAY_LEN,
    MAX_DECISION_ROLE_LEN,
  );
  if (callerRoles.arrayDropped) truncations.caller_roles_dropped = callerRoles.arrayDropped;
  if (callerRoles.stringsClamped) truncations.caller_roles_clamped = callerRoles.stringsClamped;

  let callerSubject: string | null = rawInput.callerSubject ?? null;
  if (callerSubject !== null) {
    const clamped = clampString(callerSubject, MAX_DECISION_SUBJECT_LEN);
    if (clamped.clamped) truncations.caller_subject_clamped = true;
    callerSubject = clamped.value;
  }

  let correlationId: string | null = rawInput.correlationId ?? null;
  if (correlationId !== null) {
    const clamped = clampString(correlationId, MAX_DECISION_CORRELATION_LEN);
    if (clamped.clamped) truncations.correlation_id_clamped = true;
    correlationId = clamped.value;
  }

  const matchedDropped =
    result.matchedRuleIds.length > MAX_DECISION_MATCHED_RULES
      ? result.matchedRuleIds.length - MAX_DECISION_MATCHED_RULES
      : 0;
  const matchedRuleIds =
    matchedDropped > 0
      ? result.matchedRuleIds.slice(0, MAX_DECISION_MATCHED_RULES)
      : result.matchedRuleIds;
  if (matchedDropped) truncations.matched_rule_ids_dropped = matchedDropped;

  const denyReasons = clampStringArray(
    result.denyReasons,
    MAX_DECISION_DENY_REASONS,
    MAX_DECISION_DENY_REASON_LEN,
  );
  if (denyReasons.arrayDropped) truncations.deny_reasons_dropped = denyReasons.arrayDropped;
  if (denyReasons.stringsClamped) truncations.deny_reasons_clamped = denyReasons.stringsClamped;

  let metadata: Record<string, unknown> = rawInput.metadata ?? {};
  if (metadataBytes(metadata) > MAX_DECISION_METADATA_BYTES) {
    metadata = { __replaced: true, __original_bytes: metadataBytes(rawInput.metadata ?? {}) };
    truncations.metadata_replaced = true;
  }

  if (Object.keys(truncations).length > 0) {
    const annotated = { ...metadata, [TRUNCATION_MARKER_KEY]: truncations };
    // Adding the marker can re-exceed the cap on already-large metadata.
    // If so, drop the original keys and keep only the truncation marker —
    // that's the audit-essential bit.
    metadata =
      metadataBytes(annotated) > MAX_DECISION_METADATA_BYTES
        ? { [TRUNCATION_MARKER_KEY]: truncations }
        : annotated;
  }

  return {
    policyTags: policyTags.values,
    capabilityTags: capabilityTags.values,
    callerRoles: callerRoles.values,
    callerSubject,
    correlationId,
    matchedRuleIds,
    denyReasons: denyReasons.values,
    metadata,
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

      const bounded = boundDecisionRow(input, result);
      const decisionRow: DbEigenPolicyDecisionRow = {
        id: crypto.randomUUID(),
        allowed: result.allowed,
        policy_tags: bounded.policyTags,
        capability_tags: bounded.capabilityTags,
        caller_roles: bounded.callerRoles,
        caller_subject: bounded.callerSubject,
        matched_rule_ids: bounded.matchedRuleIds,
        deny_reasons: bounded.denyReasons,
        correlation_id: bounded.correlationId,
        evaluation_ms: Math.max(0, evaluationMs),
        metadata: bounded.metadata,
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
