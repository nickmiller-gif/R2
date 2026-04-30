-- Input bounds for eigen_policy_decisions.
--
-- evaluate() in src/services/eigen/policy-engine.service.ts truncates these
-- fields at record time so the eval contract holds (audit is best-effort,
-- the result must still flow back). These CHECK constraints are second line
-- of defence: any caller path that writes the audit row directly — or any
-- future code that bypasses the service-layer truncator — still cannot
-- inflate audit storage or degrade operator audit reads.
--
-- Keep these bounds in sync with MAX_DECISION_* constants in
-- src/services/eigen/policy-engine.service.ts.
--
-- Additive only: the table was created in 202604290001 and has no rows past
-- production deploy of that migration that exceed these caps. evaluate()
-- writes from upstream Eigen surfaces (eigen-chat, eigen-retrieve, etc.)
-- which pass small bounded inputs in normal operation; pathological values
-- are bugs in those callers and the truncator handles them before the
-- insert.

-- Element-count caps + total-bytes caps per array. Total-bytes catches the
-- "few elements, each gigantic" shape that cardinality alone misses; the
-- service-layer truncator already enforces per-element length, this is the
-- DB backstop. array_to_string with a NUL separator is IMMUTABLE and adds
-- N-1 bytes of separators for an N-element array — small overhead vs the
-- caps below.
ALTER TABLE public.eigen_policy_decisions
  ADD CONSTRAINT eigen_policy_decisions_policy_tags_bounds
    CHECK (
      cardinality(policy_tags) <= 32
      AND length(array_to_string(policy_tags, E'\x01')) <= 32 * 256
    ),
  ADD CONSTRAINT eigen_policy_decisions_capability_tags_bounds
    CHECK (
      cardinality(capability_tags) <= 32
      AND length(array_to_string(capability_tags, E'\x01')) <= 32 * 256
    ),
  ADD CONSTRAINT eigen_policy_decisions_caller_roles_bounds
    CHECK (
      cardinality(caller_roles) <= 16
      AND length(array_to_string(caller_roles, E'\x01')) <= 16 * 64
    ),
  ADD CONSTRAINT eigen_policy_decisions_matched_rule_ids_bounds
    CHECK (cardinality(matched_rule_ids) <= 256),
  ADD CONSTRAINT eigen_policy_decisions_deny_reasons_bounds
    CHECK (
      cardinality(deny_reasons) <= 256
      AND length(array_to_string(deny_reasons, E'\x01')) <= 256 * 2048
    ),
  ADD CONSTRAINT eigen_policy_decisions_caller_subject_bounds
    CHECK (caller_subject IS NULL OR length(caller_subject) <= 256),
  ADD CONSTRAINT eigen_policy_decisions_correlation_id_bounds
    CHECK (correlation_id IS NULL OR length(correlation_id) <= 128),
  ADD CONSTRAINT eigen_policy_decisions_metadata_bounds
    CHECK (octet_length(metadata::text) <= 8192),
  ADD CONSTRAINT eigen_policy_decisions_evaluation_ms_nonnegative
    CHECK (evaluation_ms IS NULL OR evaluation_ms >= 0);
