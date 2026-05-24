/**
 * Append-only recorder for `eigen_policy_decisions` rows produced by the
 * shared edge-runtime enforcement path (`enforceEigenKosCapabilityBundle`).
 *
 * The Node service `evaluate()` in `src/services/eigen/policy-engine.service.ts`
 * already writes decision rows for in-process callers. The production hot
 * path — eigen-chat, eigen-retrieve, eigen-ingest, eigen-widget-chat,
 * eigen-fetch-ingest — does NOT call that service; it calls
 * `resolveEigenCapabilityAccess` via the shared engine. Without this recorder
 * the audit table built by migration 202604290001 has zero coverage of the
 * surfaces operators actually rely on.
 *
 * Semantics:
 *   - Best-effort: insert failures are reported to the supplied error sink
 *     and swallowed so a decision-recording outage cannot break enforcement.
 *   - Single row per bundle evaluation (one `enforceEigenKosCapabilityBundle`
 *     call), mirroring how the Node service emits one row per `evaluate()`.
 *     `allowed` reflects the whole bundle: false if any required capability
 *     was denied, true otherwise.
 *   - Schema-faithful: DB CHECK constraints from migration 202604290002
 *     mirror the service-layer `EIGEN_DECISION_BOUNDS`. We rely on those at
 *     the storage layer and do not re-validate here — a bounds violation
 *     surfaces as a recording error, not an enforcement failure.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logWarn } from './log.ts';

/**
 * Caller-supplied audit context. Every field is optional so a surface can
 * opt into recording incrementally without breaking the enforcement contract.
 * Recording is enabled when this object is provided (even with all fields
 * undefined) — that signals the caller deliberately wants an audit trail.
 */
export interface EigenPolicyDecisionAuditContext {
  /** Auth subject (`auth.claims.userId` typically). Null-safe. */
  callerSubject?: string;
  /** Request-trace identifier. Pair with `withRequestMeta` correlation ID. */
  correlationId?: string;
  /**
   * Free-form structured context. Kept under 4 KB JSON by the table's
   * `eigen_policy_decisions_metadata_bounds` CHECK constraint; oversized
   * values fail at the storage layer and are swallowed by the recorder.
   */
  metadata?: Record<string, unknown>;
}

export interface RecordEigenPolicyBundleDecisionInput {
  allowed: boolean;
  policyTags: string[];
  capabilityTags: string[];
  callerRoles: string[];
  matchedRuleIds: string[];
  denyReasons: string[];
  evaluationMs: number | null;
  audit: EigenPolicyDecisionAuditContext;
  surface: string;
}

export interface RecordEigenPolicyBundleDecisionOptions {
  /**
   * Sink for recording errors. Defaults to a structured `logWarn` line so
   * the failure is correlatable with the surrounding request in cloud logs.
   * Mirrors the `onRecordError` shape used by the Node service so operators
   * can wire the same logger across both paths.
   */
  onRecordError?: (err: unknown) => void;
}

const DEFAULT_ERROR_SINK = (err: unknown): void => {
  logWarn('eigen-policy-decision recorder insert failed', {
    functionName: 'eigen-policy-decision-recorder',
    error: err instanceof Error ? err.message : String(err),
  });
};

/**
 * Insert one `eigen_policy_decisions` row. Returns the decision id on
 * success, `null` on failure (logged via `onRecordError`). Never throws.
 *
 * `surface` is folded into `metadata.surface` rather than a top-level
 * column because the table schema predates per-surface attribution and we
 * don't want to migrate it just to add a single string. Operator queries
 * already use `metadata->>'surface'` for surface filtering elsewhere.
 */
export async function recordEigenPolicyBundleDecision(
  client: SupabaseClient,
  input: RecordEigenPolicyBundleDecisionInput,
  options: RecordEigenPolicyBundleDecisionOptions = {},
): Promise<string | null> {
  const onRecordError = options.onRecordError ?? DEFAULT_ERROR_SINK;
  const surfaceMetadata = {
    ...(input.audit.metadata ?? {}),
    surface: input.surface,
  };
  try {
    const { data, error } = await client
      .from('eigen_policy_decisions')
      .insert([
        {
          allowed: input.allowed,
          policy_tags: input.policyTags,
          capability_tags: input.capabilityTags,
          caller_roles: input.callerRoles,
          caller_subject: input.audit.callerSubject ?? null,
          matched_rule_ids: input.matchedRuleIds,
          deny_reasons: input.denyReasons,
          correlation_id: input.audit.correlationId ?? null,
          evaluation_ms: input.evaluationMs,
          metadata: surfaceMetadata,
        },
      ])
      .select('id')
      .single();
    if (error) {
      onRecordError(error);
      return null;
    }
    return (data?.id as string | undefined) ?? null;
  } catch (err) {
    onRecordError(err);
    return null;
  }
}
