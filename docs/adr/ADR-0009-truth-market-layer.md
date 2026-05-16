# ADR-0009 — R2 Truth Market layer (Eigen)

| Field  | Value        |
| ------ | ------------ |
| Status | **Accepted** |
| Date   | 2026-05-16   |

## Context

The R2 ecosystem already implements capture → normalize → entity resolve → evidence → Oracle → operator action → outcomes on Eigen (`zudslxucibosjwefojtm`). Truth Market is the **2035 product wrapper**: it adds **Missing Institution Briefs (MIB)** and governed listings between Oracle opportunities and Operator Workbench—without a second database.

Wire Plan Phase 4 (`oracle_opportunities`) and Phase 6–7 (Today triage, outcomes) are prerequisites; this ADR records the Truth Market slice that extends Phase 4.

## Decision

1. **Single substrate** — All Truth Market tables live in `public` on the R2 (Eigen) project. No forked Truth Market DB.
2. **MIB is derived** — `missing_institution_briefs` are created from operator promotion, feed clusters, or (later) Oracle automation—not raw model output. Status workflow: `draft` → `review` → `published` → `archived`.
3. **Canonical opportunities** — `public.oracle_opportunities` on Eigen is the portfolio object for Truth Market. CentralR2 Tower (`ukffrvqainkntdgjzyde`) renewal `oracle_opportunities` remain domain-local until a future bridge ADR.
4. **Evidence links** — MIBs attach to `platform_feed_items`, `oracle_evidence_items`, and optionally `knowledge_chunks` via `missing_institution_evidence_links` with exactly one target per row.
5. **Publication** — MIBs in `published` status require operator/counsel/admin role and respect Oracle publication boundary (`eigen_public` vs `eigenx`). No autonomous publish.
6. **Deferred v2 tables** — `truth_market_listings`, operator matches, capital paths, and proof-test tables stay jsonb on MIB until indexing need is proven.

## Consequences

- Operator Workbench gains `/truth-market` for MIB review; White Space promotion calls `truth_market_promote` RPC.
- KB-four drivers use signal-contract literals: `centralr2`, `operator_workbench`, `r2chart`, `ip_pulse_point` (see `@r2/signal-contract` and `@r2/meg-catalog`).
- PRs cite [Pitfall C4] for `database.types.ts` regen and [Pitfall C6] for view changes.

## Related

- [R2-Ecosystem-Wire-Plan.md](../../../R2-Ecosystem-Wire-Plan.md) §6, §12 Phases 4–7
- Migration `20260516210000_truth_market_phase0.sql`
