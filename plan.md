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
| MEG identity handshake contracts with Charter/Oracle/Eigen | ✅ complete | Oracle + Eigen meg_entity_id FKs, MegEntityLookup port, MegCrossDomainResolver, domain ports, GIN index on entity_ids |
| Supabase migration drift CI check | ✅ complete | `scripts/check-supabase-migration-drift.sh` + `REQUIRE_SUPABASE_REMOTE_CHECKS=true` in ci.yml |
| Type generation check in CI | ✅ complete | `scripts/check-supabase-generated-types.sh` — compares `database.types.ts` to live schema |
| Eigen ecosystem ingest rollout (6 producers) | ✅ complete | All 6 apps live: ip-insights-hub, centralr2-core, hpseller, project-darling, r2app, health-supplement-tr. 22 docs, 111 chunks, 1536-dim embeddings. PR #85 merged. |

## Next Slices (not yet started)

- Supabase client injection pattern (DI-friendly client factory)
- Eigen policy engine + capability registry (EigenX/KOS upgrade)

## Recently landed (still iterate in follow-ups)

- Oracle publication + governance boundary (signals + theses publication workflow, `oracle_publication_events`, RLS for published vs operator roles) — see `202604090004_oracle_publication_boundary_and_read_models.sql`
- Oracle briefing / theme map / feed history read models — DB views + `oracle-read-models` edge function + `202604100003_oracle_read_model_view_grants.sql`
- Eigen rollout: oracle-read-models edge function, MEG cross-domain identity, knowledge-chunk policy extensions, CI enforcement, ecosystem-wide ingest verification — PR #85

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
