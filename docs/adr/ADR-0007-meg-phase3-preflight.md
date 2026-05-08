# ADR-0007 · MEG Phase 3 pre-flight locks (Eigen)

| Field  | Value        |
| ------ | ------------ |
| Status | **Accepted** |
| Date   | 2026-05-08   |

## Context

Phase 3 (MEG mandatory) execution is governed by [R2-MEG-Conversion-Runbook.md](../../../R2-MEG-Conversion-Runbook.md) §0 and [meg-phase3-readiness-checklist.md](../meg-phase3-readiness-checklist.md) §2. The runbook’s historical reference to `ADR-0004-meg-phase3-preflight` collides with [ADR-0004-agent-autonomy.md](../ADR-0004-agent-autonomy.md) (agent autonomy). **This ADR is the canonical pre-flight lock for MEG Phase 3.**

Companion: [meg-phase3-centralr2-resolver-research.md](../meg-phase3-centralr2-resolver-research.md) · `@r2/meg-catalog@1.0.0` in `R2/packages/meg-catalog/`.

## Decision — six pre-flight locks (§2 checklist)

1. **Resolver (runbook §0.1 / §2.1)**  
   Canonical resolver is **`public.meg_resolve_or_create`** on the R2 (Eigen) Supabase project (`zudslxucibosjwefojtm`), alongside `public.meg_entities` and `public.meg_entity_source_refs`. Legacy centralr2 **`meg-engine`** naming is out of scope; dedup heuristics from centralr2 edge functions (`entity-dedup`, `document-dedup`, `property-dedup`, etc.) are consolidated **into this RPC and worker paths** over time, not a second monolith in centralr2.

2. **Cross-project JWT (runbook §0.2 / §2.2)**  
   External retreat / cross-project calls use a **dedicated scoped** service-role JWT (e.g. `MEG_RETREAT_SERVICE_ROLE_JWT` per runbook). **Do not** reuse `EXTERNAL_SERVICE_ROLE_KEY`. Runbook Playbooks **L–O** and migration **2.3d** (external retreat link columns) stay **deferred** until audit **S1** (JWT validation in `upload-retreat-content`) is shipped.

3. **Catalog freeze (runbook §0.3 / §2.3)**  
   **`@r2/meg-catalog@1.0.0`** is locked. New node or edge types require semver + a follow-up ADR.

4. **Backfill batch size (runbook §0.4 / §2.4)**  
   Default **500** rows per batch in `meg-backfill-source`; raise to **5,000** only for tables ≥ ~1M rows and low-traffic windows. Batches are idempotent and cursor-resumable.

5. **Staging / production posture (runbook + §2.5)**  
   Shared Eigen production changes follow [production-deploy-checklist.md](../production-deploy-checklist.md): validate with **`dry_run`** first, then limited live batches; migrations and edge deploys are **out-of-band** from ad-hoc `db push` as the sole gate.

6. **S1 gate (§2.6)**  
   Until S1 ships, **no** external-retreat backfill playbooks (L–O) and **no** migration 2.3d on the external retreat project.

## Consequences

- Operators cite **ADR-0007** (not ADR-0004) for MEG pre-flight in PRs and runbooks until the runbook prose is refreshed in a separate edit.
- `meg-backfill-source` adapters use `MEG_BACKFILL_BEARER` and `meg_resolve_or_create` per [Pitfall A1, A3, B1, F3].

## Status

**Accepted** — locks recorded 2026-05-08 for Phase 3 continuation on Eigen.
