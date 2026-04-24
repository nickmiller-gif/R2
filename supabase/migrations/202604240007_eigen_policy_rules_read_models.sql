-- Slice 6a: operator-facing read models on top of the versioning tables
-- landed by slice 4 (202604240006).
--
-- Two narrow SECURITY INVOKER views:
--   * `eigen_policy_rules_active_read_model` — only active rules (the ones
--     the policy engine actually evaluates at runtime). Operator dashboards
--     and the eigen-policy-rules GET default scope both key off this view
--     so they can't accidentally surface a superseded row.
--   * `eigen_policy_rule_history_read_model` — the audit timeline joined
--     back to the (possibly-now-inactive) rule so reviewers get the
--     current rule state alongside the event snapshot in a single query.
--
-- Views run as INVOKER so underlying RLS decides visibility:
--   * `eigen_policy_rules` is member-readable (the old
--     `Authenticated users can read eigen policy rules` policy).
--   * `eigen_policy_rule_history` is operator-gated (slice 4's
--     `eigen_policy_rule_history_operator_read` policy).
--
-- Additive, idempotent (CREATE OR REPLACE + DROP POLICY IF EXISTS).

-- ───────────────────────────────────────────────────────────────────────
-- Active policy rules — the runtime-authoritative set.
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.eigen_policy_rules_active_read_model
WITH (security_invoker = true) AS
SELECT
  id,
  policy_tag,
  capability_tag_pattern,
  effect,
  required_role,
  rationale,
  metadata,
  version,
  superseded_by,
  created_at,
  updated_at
FROM public.eigen_policy_rules
WHERE is_active = true;

COMMENT ON VIEW public.eigen_policy_rules_active_read_model IS
  'The active policy-rule set the Eigen KOS engine evaluates at runtime. Each row is the current version of a rule lineage; use eigen_policy_rule_history_read_model to traverse supersede chains.';

-- ───────────────────────────────────────────────────────────────────────
-- History timeline joined to current rule state for operator dashboards.
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.eigen_policy_rule_history_read_model
WITH (security_invoker = true) AS
SELECT
  h.id AS event_id,
  h.rule_id,
  h.action,
  h.before_state,
  h.after_state,
  h.actor_id,
  h.correlation_id,
  h.rationale AS event_rationale,
  h.occurred_at,
  h.metadata AS event_metadata,
  -- Current rule state (may differ from after_state if subsequent
  -- supersede / retract events ran). Null when the rule was deleted.
  r.policy_tag AS current_policy_tag,
  r.capability_tag_pattern AS current_capability_tag_pattern,
  r.effect AS current_effect,
  r.required_role AS current_required_role,
  r.version AS current_version,
  r.is_active AS current_is_active,
  r.superseded_by AS current_superseded_by
FROM public.eigen_policy_rule_history h
LEFT JOIN public.eigen_policy_rules r ON r.id = h.rule_id;

COMMENT ON VIEW public.eigen_policy_rule_history_read_model IS
  'Operator audit timeline for eigen_policy_rules. Each row is one history event (create/update/supersede/retract) with the rule''s current state joined in. Restricted to operator/counsel/admin via underlying RLS on eigen_policy_rule_history.';
