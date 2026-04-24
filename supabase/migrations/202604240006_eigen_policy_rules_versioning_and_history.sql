-- Slice 4: versioning + audit history for eigen_policy_rules.
--
-- Context:
-- The policy-rule registry has been mutation-in-place since 202604090003.
-- Operators who edit a rule today lose every prior revision: there's no way
-- to answer "what rationale did we apply last month" or "when did we tighten
-- write:* from member to operator?". Slice 2a/2b wired these rules into
-- every sensitive endpoint, so the audit gap is now a compliance blocker.
--
-- Design:
--   1. Add `version int`, `is_active boolean`, `superseded_by uuid` to
--      eigen_policy_rules. PATCH becomes: insert a new row with version+1,
--      mark predecessor is_active=false and set superseded_by=new_id.
--   2. New `eigen_policy_rule_history` captures before/after JSON on every
--      write (create / update / supersede / retract). Writes only via
--      service_role; operators SELECT.
--   3. Backfill: every existing row is logged as a single `create` history
--      entry so the audit trail starts with the current state.
--   4. Partial unique index on active rows keeps "one active allow rule per
--      (policy_tag, capability_tag_pattern, required_role)" invariant so
--      we can't accidentally ship two conflicting versions simultaneously.
--
-- Additive + idempotent. `IF NOT EXISTS` / DROP POLICY IF EXISTS so
-- re-applying is safe.

-- ───────────────────────────────────────────────────────────────────────
-- 1. Extend eigen_policy_rules
-- ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.eigen_policy_rules
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS superseded_by uuid
    REFERENCES public.eigen_policy_rules(id) ON DELETE SET NULL;

-- Partial unique indexes: only one active row per (policy_tag,
-- capability_tag_pattern, effect, required_role). Inactive (is_active=false)
-- rows don't participate so a superseded history can accumulate without
-- hitting the constraint.
--
-- Split into two partial indexes because the single-index version would need
-- a COALESCE on required_role (enum → text) which is not IMMUTABLE and
-- therefore invalid in an index expression. NULL required_role means "no
-- role restriction", so rows with NULL role are uniquely identified by the
-- (tag, pattern, effect) triple alone.
CREATE UNIQUE INDEX IF NOT EXISTS idx_eigen_policy_rules_one_active_with_role
  ON public.eigen_policy_rules (policy_tag, capability_tag_pattern, effect, required_role)
  WHERE is_active = true AND required_role IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_eigen_policy_rules_one_active_no_role
  ON public.eigen_policy_rules (policy_tag, capability_tag_pattern, effect)
  WHERE is_active = true AND required_role IS NULL;

CREATE INDEX IF NOT EXISTS idx_eigen_policy_rules_is_active
  ON public.eigen_policy_rules (is_active);

CREATE INDEX IF NOT EXISTS idx_eigen_policy_rules_superseded_by
  ON public.eigen_policy_rules (superseded_by);

-- ───────────────────────────────────────────────────────────────────────
-- 2. eigen_policy_rule_history audit log
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.eigen_policy_rule_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- May be NULL for `retract` actions where the rule row was already gone;
  -- normal operator flow supersedes (keeps the row, flips is_active).
  rule_id uuid REFERENCES public.eigen_policy_rules(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'supersede', 'retract')),
  -- Snapshot of the rule before the action (null for `create`).
  before_state jsonb,
  -- Snapshot of the rule after the action (null for `retract`).
  after_state jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  correlation_id text,
  rationale text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_eigen_policy_rule_history_rule
  ON public.eigen_policy_rule_history (rule_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_eigen_policy_rule_history_actor
  ON public.eigen_policy_rule_history (actor_id);

CREATE INDEX IF NOT EXISTS idx_eigen_policy_rule_history_occurred
  ON public.eigen_policy_rule_history (occurred_at DESC);

ALTER TABLE public.eigen_policy_rule_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eigen_policy_rule_history_operator_read
  ON public.eigen_policy_rule_history;
CREATE POLICY eigen_policy_rule_history_operator_read
  ON public.eigen_policy_rule_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text = ANY (ARRAY['operator', 'counsel', 'admin'])
    )
  );

DROP POLICY IF EXISTS eigen_policy_rule_history_service_write
  ON public.eigen_policy_rule_history;
CREATE POLICY eigen_policy_rule_history_service_write
  ON public.eigen_policy_rule_history
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ───────────────────────────────────────────────────────────────────────
-- 3. Backfill: log one `create` entry per existing rule
-- ───────────────────────────────────────────────────────────────────────

INSERT INTO public.eigen_policy_rule_history (
  rule_id,
  action,
  before_state,
  after_state,
  actor_id,
  correlation_id,
  rationale,
  occurred_at,
  metadata
)
SELECT
  r.id,
  'create',
  NULL,
  jsonb_build_object(
    'id', r.id,
    'policy_tag', r.policy_tag,
    'capability_tag_pattern', r.capability_tag_pattern,
    'effect', r.effect,
    'required_role', r.required_role,
    'rationale', r.rationale,
    'metadata', r.metadata,
    'version', COALESCE(r.version, 1),
    'is_active', COALESCE(r.is_active, true),
    'superseded_by', r.superseded_by,
    'created_at', r.created_at,
    'updated_at', r.updated_at
  ),
  NULL,
  NULL,
  'Backfill: synthetic create entry from migration 202604240006 for audit trail continuity.',
  r.created_at,
  jsonb_build_object('backfill_source', 'migration_202604240006')
FROM public.eigen_policy_rules r
WHERE NOT EXISTS (
  -- Idempotent re-run: skip rules that already have a history entry.
  SELECT 1
  FROM public.eigen_policy_rule_history h
  WHERE h.rule_id = r.id
);
