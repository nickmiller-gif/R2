-- Input bounds for eigen_policy_decisions (defense in depth).
--
-- The decision rows landed in 202604290001 carry caller-supplied content:
-- policy_tags, capability_tags, caller_roles, caller_subject, correlation_id,
-- and metadata. Every evaluate() call inserts a row, so an unbounded caller
-- can weaponise the audit table by submitting oversized arrays/strings/JSON
-- that bloat storage and slow operator queries.
--
-- The service-layer evaluate() already rejects out-of-bounds inputs (see
-- EIGEN_DECISION_BOUNDS in src/services/eigen/policy-engine.service.ts).
-- These DB-level CHECKs mirror the cardinality and aggregate-size caps so
-- anything bypassing the service (direct service_role inserts, future call
-- paths) still fails closed.
--
-- Per-element string length is enforced at the service layer; PostgreSQL
-- CHECK constraints cannot contain subqueries, so the DB layer bounds the
-- aggregate text size via array_to_string(..., '|') length. This defends
-- the same property — storage / index bloat — without introducing a helper
-- function. The same pattern is used in 202604280001_signal_contract_input_bounds.
--
-- Bounds for matched_rule_ids and deny_reasons are sized to current rule
-- counts: the matcher returns at most one entry per rule, and rule volume is
-- operator-curated. 1000 leaves ample headroom.
--
-- Self-consistency check: an allowed=true decision must not carry deny
-- reasons. The evaluator (src/lib/eigen/eigen-policy-eval.ts) already
-- guarantees this; the constraint catches a class of caller bugs in
-- tests/staging before they pollute the audit trail with internally
-- inconsistent rows.
--
-- Additive only. The decisions table just landed (202604290001) and is
-- empty in every environment, so these constraints can be ALTER ADDed
-- without a backfill.

ALTER TABLE public.eigen_policy_decisions
  ADD CONSTRAINT eigen_policy_decisions_caller_subject_bounds
    CHECK (caller_subject IS NULL OR length(caller_subject) <= 256),
  ADD CONSTRAINT eigen_policy_decisions_correlation_id_bounds
    CHECK (correlation_id IS NULL OR length(correlation_id) <= 128),
  ADD CONSTRAINT eigen_policy_decisions_policy_tags_bounds
    CHECK (
      cardinality(policy_tags) <= 32
      AND length(array_to_string(policy_tags, '|')) <= 32 * 128
    ),
  ADD CONSTRAINT eigen_policy_decisions_capability_tags_bounds
    CHECK (
      cardinality(capability_tags) <= 64
      AND length(array_to_string(capability_tags, '|')) <= 64 * 128
    ),
  ADD CONSTRAINT eigen_policy_decisions_caller_roles_bounds
    CHECK (
      cardinality(caller_roles) <= 16
      AND length(array_to_string(caller_roles, '|')) <= 16 * 64
    ),
  ADD CONSTRAINT eigen_policy_decisions_matched_rule_ids_bounds
    CHECK (cardinality(matched_rule_ids) <= 1000),
  ADD CONSTRAINT eigen_policy_decisions_deny_reasons_bounds
    CHECK (
      cardinality(deny_reasons) <= 1000
      AND length(array_to_string(deny_reasons, '|')) <= 1000 * 1000
    ),
  ADD CONSTRAINT eigen_policy_decisions_metadata_bounds
    CHECK (octet_length(metadata::text) <= 4096),
  ADD CONSTRAINT eigen_policy_decisions_evaluation_ms_nonnegative
    CHECK (evaluation_ms IS NULL OR evaluation_ms >= 0),
  ADD CONSTRAINT eigen_policy_decisions_allow_has_no_deny_reasons
    CHECK (allowed = false OR cardinality(deny_reasons) = 0);
