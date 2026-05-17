# @r2/meg-catalog — CHANGELOG

All catalog vocabulary changes. Semver per the governance rules in `README.md`:

- **Patch** — documentation only.
- **Minor** — additive literals only (new union members) + ADR note.
- **Major** — rename or remove literals.

## v1.1.0 — 2026-05-17 (Accepted ADR-0007)

Adds 10 new `MegSourceSystem` literals:

- `oracle_signals` — Oracle white-space pipeline signal emits
- `oracle_theses` — Oracle pipeline thesis emits
- `knowledge_chunks` — Oracle ingestion chunked-knowledge emits
- `productivity_workflow` — centralr2-core Phase D workflow producer
- `regrid_external` — external Regrid parcel API ingest
- `meg` — meta-source filter for entities sourced from MEG itself
- `r2_works` — meta-source filter for r2-works-sourced entities
- `r2app` — r2app Lovable surface real producer
- `friction_zero` — operator-workbench Friction Zero outbound producer
- `r2chart` — continuity-nexus / Charter continuity bridge

Source-code renames applied at the same time:

- `productivity` → `productivity_workflow` (centralr2-core/src/lib/productivityPhaseDWorkflow.ts)
- `regrid` → `regrid_external` (centralr2-core/supabase/functions/\_shared/parcelEventFeed.ts)

Plus an INSR data-layer backfill (separate migration in the insr repo): `UPDATE ... SET source_system='insr' WHERE source_system='insightr'`.

## v1.0.0 — 2026-05-04 (locked, not yet published to a registry)

Initial catalog vocabulary per ADR-0004.

**Entity types (21):**
`meg:person`, `meg:person:athlete`, `meg:person:operator`, `meg:person:speaker`,
`meg:company`, `meg:company:law_firm`, `meg:company:investor`,
`meg:property`, `meg:property:tower`, `meg:property:residential`, `meg:property:commercial`,
`meg:event`, `meg:event:retreat`, `meg:event:session`,
`meg:closing_file`, `meg:ip_matter`, `meg:patent`,
`meg:thesis`, `meg:opportunity`, `meg:document`, `meg:topic`.

**Edge types (18):**
`coffee_pairing`, `co_authored_with`, `mentored_by`, `introduced_by`,
`attended`, `spoke_at`, `sponsored`,
`affiliated_with`, `employed_by`, `represents`,
`owns`, `closed_for`, `licensed_to`,
`cited_in`, `references`, `relates_to`,
`succeeded_by`, `participates_in`.

**Source-system literals (16):**
`rays_retreat`, `centralr2`, `operator_workbench`, `oracle_operator`,
`autonomous_bot_os`, `cloudflare_agent_chatbot`, `forma_health`,
`health_supplement_tr`, `smartplrx`, `smartplrx_trend_tracker`,
`ip_pulse_point`, `hpseller`, `open_intel_commons`, `insr`,
`r2_widget`, `plrx_external`.

### Pre-publish in-place rename (no version bump)

- `ip_insights_hub` → `ip_pulse_point` on 2026-05-10. The `ip-insights-hub` repo was replaced wholesale by `ip-pulse-point`. Since v1.0.0 has not yet shipped to any registry, this rename happens inside v1.0.0 rather than triggering a major bump.

### Pre-publish source-code drift fixes (no catalog change)

15 source-code drift cases fixed via direct rename — see `README.md` "Pre-publish source-code normalization log" for the full table.
