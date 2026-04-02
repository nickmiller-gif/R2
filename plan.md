# R2 Import Plan (Slice-by-Slice)

This plan defines the incremental import path from the old source repository into R2 as the central backend/core.

## Guardrails

- Central Supabase project remains the only system of record.
- MEG identity model remains canonical.
- No frontend shell code is imported into this repository.
- Each slice must be small, reviewable, and reversible (minimum blast radius).
- No direct broad copy; only targeted, verified slices.

## Import Order

1. Charter Slice 01: governance kernel + provenance + audit read path.
2. Charter Slice 02: next verified governance primitive.
3. Oracle slices (incremental, boundary-checked).
4. Eigen/shared runtime slices with proven backend utility.

## Active Slice Specification

- Current active slice doc:
  - `docs/imports/charter-slice-01-governance-kernel.md`

All import work for the active slice must map to that file list exactly.

## Operational Process Per Slice

1. Select one bounded primitive from legacy source.
2. Define R2 target contract first (schema + service + types).
3. Implement migrations and service scaffolding.
4. Add/extend tests.
5. Document boundaries and rollout notes.
6. Run checks.
7. Open PR and merge when verified.

## Stop Conditions

Pause merge if any of the following occurs:
- frontend/module-shell code appears in diff
- unrelated domain files (Oracle/Eigen) are added
- migrations include tables/views outside declared slice
- tests require broad shared imports not in slice map
