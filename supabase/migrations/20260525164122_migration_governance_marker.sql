-- Migration governance marker — documents post-apply edit policy for
-- 20260525000001_legislation_jurisdiction_aliases.sql (pg_trgm
-- self-containment). Canonical hardening DDL lives in
-- 20260525120000_legislation_jurisdiction_normalization_hardening.sql.
-- See docs/MIGRATION_GOVERNANCE.md. No-op on apply.

select 1 as migration_governance_marker;;
