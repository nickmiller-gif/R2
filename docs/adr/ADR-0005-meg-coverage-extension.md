# ADR-0005: Extend MEG identity coverage to all source-system repos

| Field   | Value                                                                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Status  | **Accepted**                                                                                                                                  |
| Date    | 2026-05-17                                                                                                                                    |
| Author  | R2 Unification Audit                                                                                                                          |
| Related | ADR-0004 (MEG Phase 3 pre-flight), [R2-MEG-Conversion-Runbook.md](../../../R2-MEG-Conversion-Runbook.md), `R2/packages/meg-catalog/src/v1.ts` |

## Context

The MEG (Master Entity Graph) catalog v1.0.0 declares 16 valid `MegSourceSystem`
values (rays_retreat, centralr2, operator_workbench, oracle_operator,
autonomous_bot_os, cloudflare_agent_chatbot, forma_health, health_supplement_tr,
smartplrx, smartplrx_trend_tracker, ip_pulse_point, hpseller,
open_intel_commons, insr, r2_widget, plrx_external).

The 2026-05-10 unification audit measured `meg_entity_id` / `meg_canonical_id`
coverage across every R2 repo and found a hard split:

| Tier                       | Repos                                                                                                            | Status                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Production-grade**       | centralr2-core (170 refs / 20 files), operator-workbench (236 refs / 11 files)                                   | UI, hooks, edge functions, migrations all wired                                                                          |
| **Generated types only**   | hpseller (80 refs / 1 file: `database.types.ts`), oracle-operator (81 refs / 2 files), insr (218 refs / 2 files) | The Supabase type generator picks up `meg_*` columns from the central project, but no business code reads or writes them |
| **Functional ingest only** | cloudflare-agent-chatbot (14/5), autonomous-bot-os-in (9/4)                                                      | Signal ingest stamps source_system but no bidirectional MEG link                                                         |
| **Token presence only**    | r2app (4/2 — has `20260505190000_meg_entity_link_columns.sql`), continuity-nexus (1/1 — Phase A migration only)  | Migration shipped, business surface still pre-MEG                                                                        |
| **Zero coverage**          | ray-s-retreat, formahealth, health-supplement-tr, ip-pulse-point, open-intel-commons                             | No `meg_entity_id` columns anywhere; entities live in repo-local schemas with no canonical resolution                    |

**Concrete consequence**: a "property" in centralr2-core (`public.properties`
with `meg_entity_id` + `meg_canonical_id`) cannot be resolved to the same node
referenced in ray-s-retreat (which has retreat-related entities but no MEG
columns). Likewise an "ip_matter" referenced in r2-ip cannot be linked to an
opportunity in centralr2 without manual reconciliation.

## Decision

**Accepted posture:** extend MEG identity coverage to every Tier-2/3/4/5 repo above,
using the catalog vocabulary unchanged at v1.0.0, in the wave framework below.
**Rollout begins with Wave A** in this order (lowest risk first; see
[R2-Drift-Resolution-Plan.md](../../../R2-Drift-Resolution-Plan.md) Hotspot 1):

1. **ray-s-retreat** — exemplar Wave-A migration pattern
2. **ip-pulse-point** — highest cross-repo dedup leverage
3. **formahealth** — public-mode; registry row may stay `paused` until vanity DNS
4. **open-intel-commons** — **confirmed no-op** for schema (stateless editorial; decision-only in Wave A)
5. **health-supplement-tr** — Wave-A migration after infra (`supabase/config.toml`, robots)
6. **continuity-nexus Phase C** — bidirectional / HTTPS-bridged resolver into Eigen (`zudslxucibosjwefojtm`) after Wave-A repos; Track A in Drift Plan

**Wave A (zero-coverage brand-sites):** steps 1–5 above. Each repo that carries
domain tables gets a thin migration adding `meg_entity_id uuid` +
`meg_canonical_id text`, populated by `meg_resolve_or_create` per the MEG
Conversion Runbook. No bidirectional link until continuity Phase C.

**Wave B (token-presence repos):** r2app, continuity-nexus UI/backfill on top of
existing link-column migrations.

**Wave C (cross-repo bidirectional link):** continuity-nexus Phase C and peers —
HTTPS-bridged resolver from Eigen into consumer projects (ADR-0004 §0.2). Gated
on `r2-signal-ingest` auth posture per ADR-0003.

**Wave D (operator consoles + intelligence):** oracle-operator, hpseller, insr —
promote from types-only to UI surfaces; verify `source_system` literals match the
catalog.

## Consequences

- Every entity surfaced anywhere in R2 will resolve to the same MEG canonical
  ID. A "property" viewed in centralr2 will be the same as the one referenced
  in ray-s-retreat or insr, satisfying the unification requirement.
- Catalog stays at v1.0.0 — no new entity or source-system types introduced by
  this ADR. Any drift in existing source_system literals must be corrected to
  match the catalog string (snake_case, no hyphens).
- The `v_meg_registry_external_identity_drift` view in centralr2-core (added
  by `20260427130000_meg_identity_contract_and_registry_sync.sql`) becomes the
  enforcement telemetry — extend it to cover Wave-A tables once migrations land.
- Wave C is the highest-risk step (cross-project HTTPS resolution) and must be
  gated on the `r2-signal-ingest` JWT validation fix per ADR-0003.

## Operator follow-through

Cross-links to the umbrella operator queue ([STATUS.md](../../../STATUS.md)):

| Queue # | Action                                                                                                                                                               |
| ------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   **1** | ~~Accept ADR-0005~~ — **done** (this ADR, 2026-05-17)                                                                                                                |
|   **3** | Lovable redeploy brand-sites with `index.html` + JSON-LD changes (ray-s-retreat, formahealth, hpseller, insr, ip-pulse-point, oracle-operator, health-supplement-tr) |
|   **6** | Apply Wave-A migrations to each brand-site Supabase via Lovable redeploy                                                                                             |

## Related

- [R2-Drift-Resolution-Plan.md](../../../R2-Drift-Resolution-Plan.md) — Hotspot 1, Wave-A sequencing and acceptance criteria
- [STATUS.md](../../../STATUS.md) — operator action queue items **1**, **3**, **6**
- [R2-Master-Brief.md](../../../R2-Master-Brief.md) § 14 open decision #1
- [meg-domain-onboarding.md](../meg-domain-onboarding.md)
