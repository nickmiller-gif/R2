-- Eigen policy decision provenance.
--
-- Context:
-- The rule registry (202604090003) and rule-mutation history (202604240006)
-- already cover *what rules exist* and *how rules changed*. They do NOT
-- capture *how a request was decided*: which rules fired on a given evaluate()
-- call, what the caller asked for, or whether the answer was allow or deny.
-- That gap means an operator inspecting an audit trail today can reconstruct
-- the policy at time T but cannot prove how a specific request was resolved.
--
-- Design:
--   eigen_policy_decisions is an append-only evaluation trace. One row per
--   evaluate() call from the policy-engine service. Captures the request
--   context (policy_tags, capability_tags, caller_roles, caller_subject,
--   correlation_id), the outcome (allowed, matched_rule_ids, deny_reasons),
--   and a perf signal (evaluation_ms). Rule IDs are NOT FK-linked because
--   superseded rules can be deleted/inactive while their decisions must
--   remain auditable.
--
--   RLS mirrors eigen_policy_rule_history: operator/counsel/admin SELECT,
--   service_role INSERT only.
--
-- Additive + idempotent. IF NOT EXISTS / DROP POLICY IF EXISTS so re-applying
-- is safe.

CREATE TABLE IF NOT EXISTS public.eigen_policy_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allowed boolean NOT NULL,
  policy_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  capability_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  caller_roles text[] NOT NULL DEFAULT ARRAY[]::text[],
  caller_subject text,
  matched_rule_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  deny_reasons text[] NOT NULL DEFAULT ARRAY[]::text[],
  correlation_id text,
  evaluation_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eigen_policy_decisions_recorded
  ON public.eigen_policy_decisions (recorded_at DESC);

-- Partial index for the common audit query "show recent denies".
CREATE INDEX IF NOT EXISTS idx_eigen_policy_decisions_denies
  ON public.eigen_policy_decisions (recorded_at DESC)
  WHERE allowed = false;

CREATE INDEX IF NOT EXISTS idx_eigen_policy_decisions_correlation
  ON public.eigen_policy_decisions (correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eigen_policy_decisions_subject
  ON public.eigen_policy_decisions (caller_subject)
  WHERE caller_subject IS NOT NULL;

-- Deferred: GIN on matched_rule_ids. Every evaluate() inserts a row, so
-- write amplification is non-trivial. Add when an operator query path
-- (e.g. "which decisions did rule X drive?") actually exists.

ALTER TABLE public.eigen_policy_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eigen_policy_decisions_operator_read
  ON public.eigen_policy_decisions;
CREATE POLICY eigen_policy_decisions_operator_read
  ON public.eigen_policy_decisions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text = ANY (ARRAY['operator', 'counsel', 'admin'])
    )
  );

DROP POLICY IF EXISTS eigen_policy_decisions_service_write
  ON public.eigen_policy_decisions;
CREATE POLICY eigen_policy_decisions_service_write
  ON public.eigen_policy_decisions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
