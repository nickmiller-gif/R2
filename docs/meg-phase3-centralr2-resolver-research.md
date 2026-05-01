# Phase 3 — centralr2 dedup → R2 `meg_resolve_or_create` (research map)

## Workspace finding

The umbrella checkout **does not contain** a `centralr2-core` tree, so this file records the **intended** porting map from [R2-MEG-Conversion-Runbook.md](../../R2-MEG-Conversion-Runbook.md) §0.1 and ecosystem planning docs. When a centralr2 checkout is available, verify paths under that repo’s `supabase/functions/`.

## Naming correction (vs wire plan / runbook prose)

Planning docs refer to a monolithic **`meg-engine`** edge function in centralr2. That name **does not appear in this workspace** and may be outdated. The practical consolidation target is:

- **`meg_resolve_or_create`** (Postgres RPC in the R2 Supabase project), invoked by the Phase 3 backfill worker and future producers.

Resolver **logic** should be sourced from whatever centralr2 ships today—commonly split edge functions such as:

| Expected centralr2 function (verify in repo) | Likely responsibility                        |
| -------------------------------------------- | -------------------------------------------- |
| `entity-dedup`                               | People / org identity keys, merge candidates |
| `document-dedup`                             | Document-level canonicalization              |
| `property-dedup`                             | Property / asset deduplication               |

**Action when centralr2 is on disk:** list `supabase/functions/`, read each handler’s input/output and shared helpers, then design one RPC contract (inputs: source_system, entity_type, fingerprint fields, optional source ref) that preserves the strongest invariants from all three.

## R2 target architecture (Phase 3)

1. **Canonical identity registry** for new work lives in R2 **`public.meg_entities`**, with provenance in **`public.meg_entity_source_refs`**, graph links in **`public.meg_entity_edges`**, and typed **sidecars** (see migrations `202605010001_*` and `202605030001_*`). Legacy Oracle tables **`public.entities`** / **`public.entity_relations`** remain separate; do not conflate them with MEG in new ingest code.
2. **Link columns** on producer projects point at R2 MEG UUIDs (`meg_entity_id` / `actor_meg_entity_id` patterns in the runbook §2.3 sense).
3. **Backfill edge function** [`meg-backfill-source`](../supabase/functions/meg-backfill-source/index.ts) (runbook §3) batches source rows, calls **`meg_resolve_or_create`**, upserts sidecars, writes link columns—idempotent and cursor-paged.

## Open questions for resolver design

- Do legacy dedup functions assume **centralr2-local** tables only? If yes, the unified RPC must accept **normalized payloads** from the backfill worker instead of reading foreign tables directly.
- Where do fingerprints (email, domain, phone, external_id) already exist in centralr2? Align column mapping in ADR-0004 follow-up implementation notes.

## Verification log

| Date       | Actor | Result                                                                                                                                         |
| ---------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-30 | Agent | Linked R2 project has `public.entities` and `public.entity_relations` (`to_regclass` both non-null). No centralr2 sources in umbrella to diff. |
