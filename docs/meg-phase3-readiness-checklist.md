# Phase 3 MEG — readiness checklist (handoff)

Use this list with **audit (S1)**, **external retreat**, and **platform** owners before executing [R2-MEG-Conversion-Runbook.md](../../R2-MEG-Conversion-Runbook.md) end-to-end. Deep detail stays in the runbook; this is the **go / no-go** surface.

**Related:** [ADR-0007 — MEG Phase 3 pre-flight](./adr/ADR-0007-meg-phase3-preflight.md) · [centralr2 resolver research](./meg-phase3-centralr2-resolver-research.md) · `@r2/meg-catalog` in `R2/packages/meg-catalog/`

---

## 1. Verified facts (2026-04-30)

| Check                                               | Result                                                                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **`public.entities` on linked R2 Supabase**         | **Present** — `to_regclass('public.entities')` → `entities`                                                                      |
| **`public.entity_relations` on linked R2 Supabase** | **Present** — `to_regclass('public.entity_relations')` → `entity_relations`                                                      |
| **Creation migration in `R2/supabase/migrations/`** | **None** for `public.entities` — table likely created outside tracked migrations; runbook §2.1 `IF NOT EXISTS` path remains safe |
| **`@r2/meg-catalog`**                               | **Added** at `R2/packages/meg-catalog` v1.0.0 (private); publish/registry path TBD                                               |
| **centralr2 dedup sources in umbrella**             | **Not present** — map in [meg-phase3-centralr2-resolver-research.md](./meg-phase3-centralr2-resolver-research.md)                |

Command used for DB checks (from `R2/`):

```bash
supabase db query --linked "select to_regclass('public.entities'), to_regclass('public.entity_relations');"
```

---

## 2. Pre-flight locks (must be explicit before migrations)

**Status (2026-05-08):** All six locks **resolved** and recorded in [ADR-0007 — MEG Phase 3 pre-flight](./adr/ADR-0007-meg-phase3-preflight.md) (Accepted).

| #   | Topic                 | Resolution                                                                                                                     | ADR-0007 |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | **Resolver**          | R2-hosted `meg_resolve_or_create` on Eigen; centralr2 dedups port incrementally into RPC/worker (no monolithic `meg-engine`).  | §2.1     |
| 2   | **Cross-project JWT** | Dedicated scoped service JWT for retreat; **no** reuse of `EXTERNAL_SERVICE_ROLE_KEY`; Playbooks L–O + 2.3d deferred until S1. | §2.2     |
| 3   | **Catalog**           | **`@r2/meg-catalog@1.0.0`** locked; changes require semver + ADR.                                                              | §2.3     |
| 4   | **Batch size**        | Default **500** / optional **5k** for ≥1M-row tables in low-traffic windows.                                                   | §2.4     |
| 5   | **Staging**           | **Direct-to-prod** with `dry_run` + checklist gates ([production-deploy-checklist.md](./production-deploy-checklist.md)).      | §3       |
| 6   | **S1 gate**           | External retreat playbooks and migration 2.3d **deferred** until S1 ships.                                                     | §2.2     |

---

## 3. Sequencing reminder

1. ~~Stakeholder answers for §2 above.~~ Done — see ADR-0007.
2. Land ADR-0007 as **Accepted** (done 2026-05-08).
3. Apply R2 migrations (runbook §2.1–2.2, 2.4–2.6) per your staging decision.
4. Link-column migrations on other Supabase projects (Lovable / per-repo process).
5. Deploy backfill function (§3); run playbooks **A–H**, then **I** (first cross-system spine).
6. After S1: retreat playbooks **L–O** + acceptance **8.2**.

---

## 4. Exit criteria (from wire plan / runbook)

- [ ] Every playbook run ends with **errors = 0** (per runbook validation).
- [ ] **Test 8.1** after Playbook **I** (`works.clients` ↔ `ci_clients`).
- [ ] **Test 8.2** after retreat path: one person in **centralr2 and retreat** resolves to **one** MEG node.

---

## 5. Implemented in R2 repo (2026-05-01)

| Artifact         | Location                                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Schema + RPCs    | [`supabase/migrations/202605010001_meg_phase3_source_refs_sidecars_rpc.sql`](../supabase/migrations/202605010001_meg_phase3_source_refs_sidecars_rpc.sql)                                              |
| Review hardening | [`supabase/migrations/202605030001_meg_phase3_review_hardening.sql`](../supabase/migrations/202605030001_meg_phase3_review_hardening.sql) (RLS, resolver, edges)                                       |
| Backfill edge    | [`supabase/functions/meg-backfill-source/index.ts`](../supabase/functions/meg-backfill-source/index.ts) — secret **`MEG_BACKFILL_BEARER`** ([`.env.wave1.local.example`](../.env.wave1.local.example)) |
| First adapter    | `r2:oracle_theses` — fills `oracle_theses.meg_entity_id` where null (target project must have the table)                                                                                               |
| Second adapter   | `r2:platform_feed_items` — backfills `platform_feed_items.actor_meg_entity_id` where null using `inferActorMegResolveArgs` from `_shared/meg-resolve-signal.ts` (same keys as `r2-signal-process`)     |
| Signal worker    | [`supabase/functions/r2-signal-process/index.ts`](../supabase/functions/r2-signal-process/index.ts) — see bullets below                                                                                |

**`r2-signal-process` behavior:** resolves `meg_resolve_or_create` when `actor_meg_entity_id` is null but the payload has a stable **email** or **actor/user id**; updates `platform_feed_items` and threads the actor into `knowledge_chunks.entity_ids`.

- **Manual POST** (JWT + operator role): include **`x-idempotency-key`**, same as other mutation edge functions.
- **Internal / scheduled** callers using **`x-r2-signal-process-token`** (for example pg_cron): that header is **not** required.
- After migrations are applied on the project you typecheck against, regenerate [`database.types.ts`](../database.types.ts): from `R2/`, run `supabase gen types typescript --linked > database.types.ts` and keep CLI noise out of the file (redirect stderr elsewhere).

**Apply migrations:** For a **local or personal linked** Supabase project, `cd R2 && supabase db push --linked` is fine after review. For the **shared production** R2 project, follow [docs/production-deploy-checklist.md](./production-deploy-checklist.md) (out-of-band MCP/Dashboard/CI process — do not rely on ad-hoc `db push` as the sole production gate). Deploy edge functions from `R2/` with `supabase functions deploy …` against the intended project ref.

## 6. Optional UI artifact

For a **Cursor canvas** version of this matrix (beside chat), ask the agent to generate `phase-3-meg-readiness.canvas.tsx` under the workspace `canvases/` folder after implementation work is approved—content mirrors §2–§4.
