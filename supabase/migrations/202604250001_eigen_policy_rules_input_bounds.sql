-- Input bounds for eigen_policy_rules.
--
-- Rules are loaded on the hot path of every Eigen request (eigen-chat,
-- eigen-retrieve, eigen-ingest, eigen-tool-capabilities, eigen-widget-chat).
-- Operator-writable columns must be bounded at the DB level as a second
-- line of defence behind the eigen-policy-rules edge function validators.
-- Keep these bounds in sync with MAX_* constants in
-- supabase/functions/eigen-policy-rules/index.ts.
--
-- The wildcard caps also bound worst-case matcher work. The matcher in
-- src/lib/eigen/eigen-policy-eval.ts is linear two-pointer (ReDoS-safe by
-- construction), so these caps keep the linear factor small rather than
-- preventing an exploitable class.
--
-- Verified safe for existing seed data: max observed values across current
-- rows are policy_tag len=12 (1 wildcard), capability_tag_pattern len=7
-- (1 wildcard), rationale len=73, metadata=41 bytes — all well within
-- bounds, so this migration adds constraints without rewriting any rows.

ALTER TABLE public.eigen_policy_rules
  ADD CONSTRAINT eigen_policy_rules_policy_tag_bounds
    CHECK (
      length(btrim(policy_tag)) > 0
      AND length(policy_tag) <= 128
      AND length(regexp_replace(policy_tag, '[^*]', '', 'g')) <= 4
    ),
  ADD CONSTRAINT eigen_policy_rules_capability_tag_pattern_bounds
    CHECK (
      length(btrim(capability_tag_pattern)) > 0
      AND length(capability_tag_pattern) <= 128
      AND length(regexp_replace(capability_tag_pattern, '[^*]', '', 'g')) <= 8
    ),
  ADD CONSTRAINT eigen_policy_rules_rationale_bounds
    CHECK (rationale IS NULL OR length(rationale) <= 2000),
  ADD CONSTRAINT eigen_policy_rules_metadata_bounds
    CHECK (octet_length(metadata::text) <= 8192);
