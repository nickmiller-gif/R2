/**
 * Glue for the `supersede_eigen_policy_rule` Postgres RPC (added by
 * migration 20260530160000). The RPC performs flip-then-insert + two
 * history-row writes atomically, fixing two flaws the edge function had
 * when these were four separate Supabase calls: PATCHes that left every
 * key column unchanged hit the partial unique index on active rows, and
 * a transient audit-insert failure could commit a rule change with no
 * history row.
 *
 * Validation of the inbound PATCH body stays in the edge function so it
 * shares the same `validate*` helpers used by POST. This shim is the
 * narrow seam between "validated patch object" and "RPC argument list",
 * separated out so the argument shape is unit-testable without standing
 * up a live Postgres.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface BuildSupersedePatchInput {
  policy_tag?: unknown;
  capability_tag_pattern?: unknown;
  effect?: unknown;
  required_role?: unknown;
  rationale?: unknown;
  metadata?: unknown;
}

/**
 * Translate a validated PATCH body into the `p_patch` jsonb payload the
 * RPC expects. Only keys explicitly present on the input are included;
 * absent keys instruct the RPC to carry the predecessor's value forward.
 * Explicit `null` is preserved (e.g. clearing `required_role`).
 */
export function buildSupersedePatchPayload(
  body: BuildSupersedePatchInput,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const keys = [
    'policy_tag',
    'capability_tag_pattern',
    'effect',
    'required_role',
    'rationale',
    'metadata',
  ] as const;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      patch[k] = body[k];
    }
  }
  return patch;
}

export interface CallSupersedeRpcInput {
  ruleId: string;
  patch: Record<string, unknown>;
  actorId: string | null;
  correlationId: string | null;
  rationale: string | null;
  historyMetadata: Record<string, unknown>;
}

export interface CallSupersedeRpcResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
  error: string | null;
}

/**
 * Invoke the atomic supersede RPC and map Postgres-side error codes into
 * the HTTP-shaped statuses the edge function returns to callers.
 *
 *   P0002 -> 404 (rule not found)
 *   P0001 -> 409 (predecessor already inactive)
 *   any other -> 500
 *
 * Supabase surfaces SQLSTATEs through `error.code`; when that's absent we
 * fall through to 500 so we never silently downgrade an unknown failure.
 */
export async function callSupersedePolicyRuleRpc(
  client: SupabaseClient,
  input: CallSupersedeRpcInput,
): Promise<CallSupersedeRpcResult> {
  const { data, error } = await client.rpc('supersede_eigen_policy_rule', {
    p_rule_id: input.ruleId,
    p_patch: input.patch,
    p_actor_id: input.actorId,
    p_correlation_id: input.correlationId,
    p_rationale: input.rationale,
    p_history_metadata: input.historyMetadata,
  });
  if (error) {
    const code = (error as { code?: string }).code ?? null;
    let status = 500;
    if (code === 'P0002') status = 404;
    else if (code === 'P0001') status = 409;
    return { ok: false, status, data: null, error: error.message };
  }
  return {
    ok: true,
    status: 201,
    data: (data ?? null) as Record<string, unknown> | null,
    error: null,
  };
}
