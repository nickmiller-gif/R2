import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Audit-event writer for `eigen_policy_rule_history`.
 *
 * Mirrors the `oracle_publication_audit` pattern: the caller keeps the
 * rule mutation and its history insert separate so we can emit stable
 * warnings when history fails without rolling back the mutation. Consumers
 * wrap both calls and surface an `auditWarnings` array on the response when
 * any insert returns a non-null error message.
 *
 * `before_state` / `after_state` carry the full rule JSON. Always pass the
 * complete snapshot so operators reading the audit later don't have to
 * cross-reference the live table.
 */

export type EigenPolicyRuleAuditAction = 'create' | 'update' | 'supersede' | 'retract';

export interface InsertEigenPolicyRuleHistoryEventInput {
  ruleId: string | null;
  action: EigenPolicyRuleAuditAction;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  actorId: string | null;
  correlationId: string | null;
  rationale: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Returns `null` on success and an error message string on failure so the
 * caller can append to its `auditWarnings` array.
 */
export async function insertEigenPolicyRuleHistoryEvent(
  client: SupabaseClient,
  input: InsertEigenPolicyRuleHistoryEventInput,
): Promise<string | null> {
  const { error } = await client.from('eigen_policy_rule_history').insert({
    rule_id: input.ruleId,
    action: input.action,
    before_state: input.beforeState,
    after_state: input.afterState,
    actor_id: input.actorId,
    correlation_id: input.correlationId,
    rationale: input.rationale,
    metadata: input.metadata ?? {},
  });
  return error?.message ?? null;
}
