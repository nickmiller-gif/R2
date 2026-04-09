# R2 Import Plan (Slice-by-Slice)

This plan defines the incremental import path from the old source repository into R2 as the central backend/core.

## Guardrails

- Central Supabase project remains the only system of record.
- MEG identity model remains canonical.
- No frontend shell code is imported into this repository.
- Each slice must be small, reviewable, and reversible (minimum blast radius).
- No direct broad copy; only targeted, verified slices.

## Import Order + Status

| Slice | Status | Notes |
|-------|--------|-------|
| Charter Slice 01: governance kernel + provenance + audit read | ✅ complete | types, services, migrations, tests all passing |
| Charter Slice 02: governance primitives (entities, evidence, obligations, payouts, decisions, rights, roles) | ✅ complete | full CRUD services + edge functions |
| MEG identity spine (entities, aliases, edges) | ✅ complete | services, migrations, edge functions, tests |
| Oracle domain services (profile-run, signals, theses, evidence-items, source-packs, thesis-links, outcomes) | ✅ complete | services, migrations, edge functions, tests |
| Eigen services (knowledge-chunks, retrieval-runs, tool-capabilities, memory-entries) | ✅ complete | services, migrations, edge functions, tests |
| Foundation (asset-registry, documents) | ✅ complete | services, edge functions, tests |
| Security hardening: JWT on operator/member surfaces | ✅ complete | public Eigen chat + rate limits are exceptions; see edge function guards |
| CI workflow (typecheck + tests + no-alias-imports check) | ✅ complete | `.github/workflows/ci.yml` |

## Next Slices (not yet started)

- Oracle publication + governance boundary (internal vs operator-facing objects, publication state)
- MEG identity handshake contracts with Charter/Oracle/Eigen
- Supabase client injection pattern (DI-friendly client factory)
- Oracle briefing + theme map + feed history read models
- Eigen policy engine + capability registry (EigenX/KOS upgrade)
- Supabase migration drift CI check
- Type generation check in CI

## Active Slice Specification

- Completed slice doc:
  - `docs/imports/charter-slice-01-governance-kernel.md`

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
