-- Hardening pass for eigen_policy_rules:
--   1) Non-empty + length CHECK constraints on user-supplied text fields.
--   2) Composite UNIQUE index so duplicate (policy_tag, pattern, effect, required_role)
--      rules can't accumulate and create contradictory or redundant entries.
--   3) Dedicated immutable audit log (eigen_policy_rule_events) capturing every
--      create/update with actor + before/after snapshots. Policy rules govern
--      capability access, so changes need a traceable provenance trail.
--
-- All changes are additive. No existing rows are modified or removed; the
-- current baseline seed obeys the new bounds (<=256 / <=512 / <=2048 chars,
-- no empty strings) so constraint creation will not fail.

-- ── 1) Integrity constraints on existing columns ────────────────────────────

ALTER TABLE public.eigen_policy_rules
  ADD CONSTRAINT eigen_policy_rules_policy_tag_nonempty
    CHECK (char_length(policy_tag) > 0 AND char_length(policy_tag) <= 256),
  ADD CONSTRAINT eigen_policy_rules_capability_tag_pattern_nonempty
    CHECK (char_length(capability_tag_pattern) > 0 AND char_length(capability_tag_pattern) <= 512),
  ADD CONSTRAINT eigen_policy_rules_rationale_length
    CHECK (rationale IS NULL OR char_length(rationale) <= 2048);

-- ── 2) Composite uniqueness ─────────────────────────────────────────────────
-- required_role is nullable; COALESCE to empty string so NULL-role rows are
-- deduplicated alongside role-gated rows instead of being treated as distinct
-- for every insert (default NULL-distinct semantics).

CREATE UNIQUE INDEX IF NOT EXISTS eigen_policy_rules_unique_rule
  ON public.eigen_policy_rules (
    policy_tag,
    capability_tag_pattern,
    effect,
    COALESCE(required_role::text, '')
  );

-- ── 3) Audit log for rule mutations ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.eigen_policy_rule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.eigen_policy_rules(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('created', 'updated')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  before_snapshot jsonb,
  after_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eigen_policy_rule_events_rule
  ON public.eigen_policy_rule_events (rule_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_eigen_policy_rule_events_event_type
  ON public.eigen_policy_rule_events (event_type, created_at DESC);

ALTER TABLE public.eigen_policy_rule_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_eigen_policy_rule_events ON public.eigen_policy_rule_events;
CREATE POLICY select_eigen_policy_rule_events ON public.eigen_policy_rule_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = auth.uid()
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS insert_eigen_policy_rule_events ON public.eigen_policy_rule_events;
CREATE POLICY insert_eigen_policy_rule_events ON public.eigen_policy_rule_events
  FOR INSERT TO service_role
  WITH CHECK (true);
