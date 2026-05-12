# MEG domain onboarding — universal UUID contract

Canonical registry rows live in **`public.meg_entities`** on the R2 (Eigen) Supabase project. Every person, org, property, IP matter, event, document, thesis, etc. uses **one UUID** (`meg_entities.id`) across all apps. Legacy **`public.entities`** / **`public.entity_relations`** (Oracle-era) are **not** MEG — never write new FKs to them.

Pre-flight locks: [ADR-0004 (umbrella)](../../docs/adr/ADR-0004-meg-phase3-preflight.md) (Accepted). Vocabulary: `R2/packages/meg-catalog` (`@r2/meg-catalog@1.0.0`).

## 1. Register the domain in the catalog

1. Add a **`MegSourceSystem`** literal in `packages/meg-catalog/src/v1.ts` if this app emits signals or owns source rows not already listed.
2. Add **`MegEntityType`** / **`MegEdgeType`** entries only when introducing a **new** noun or relationship shape.
3. Bump **`MegCatalogVersion`** / package semver per ADR-0004 (minor for additive types, major for breaking renames).
4. Publish or `npm pack` the package; pin the version from producers and from `R2` migrations that add `CHECK` constraints against catalog strings.

## 2. Schema: link columns on source tables

For each row that represents a graph node, add:

- **`meg_entity_id uuid`** referencing `public.meg_entities(id)` when the table lives **on Eigen**, **or**
- **`meg_entity_id uuid` without FK** when the table lives in another Supabase project (store the Eigen UUID only), **or**
- rely on **`meg_entity_source_refs`** filled by backfill / resolver (still keyed by Eigen `meg_entities.id`).

Use defensive migrations (`DO $$ … IF to_regclass(…)`) when Lovable may lag schema. See [R2-Activation-Checklist.md](../../R2-Activation-Checklist.md) Phase 3b for the per-table punch list.

## 3. Resolver and dedup keys

### 3.0 HTTP bridge (third-party hosts)

For Lovable Cloud or other environments where embedding the Eigen **service-role** JWT is undesirable, call the **`meg-resolve-bridge`** Edge function on Eigen with a scoped **`MEG_RESOLVE_BRIDGE_TOKEN`**. Do **not** point legacy **`TOWER_MEG_RESOLVER_*`** variables at CentralR2 Tower — Tower does not implement that contract, and Tower MEG UUIDs are not the Eigen registry. See [meg-resolve-bridge.md](./meg-resolve-bridge.md).

Call **`public.meg_resolve_or_create`** (service role) with:

- **`p_entity_type`** — catalog string (`meg:person`, `meg:property`, `meg:ip_matter`, …).
- **`p_canonical_name`**, **`p_canonical_email`**, **`p_canonical_external_id`** — pick stable keys per type (email for people; APN / parcel id / address hash for property; publication / application number for IP).
- **`p_source_system`**, **`p_source_table`**, **`p_source_row_id`** — for `meg_entity_source_refs` uniqueness (`(source_system, source_table, source_row_id)`).

Document match priority for each `entity_type` before wide backfills; use **`merge_target_id`** on `meg_entities` when operators merge duplicates.

## 4. Signals

Use **`r2-signal-contract` v1**:

- Set **`actor_meg_entity_id`** when the producer already resolved the actor.
- Set **`related_entity_ids`** to known MEG UUIDs when available.
- Put **candidate** external ids / typed hints in **`raw_payload`** (e.g. `property_external_id`, `ip_matter_id`, `patent_number`) so **`r2-signal-process`** can call `meg_resolve_or_create` for related rows (bounded — see `_shared/meg-resolve-signal.ts`).

## 5. Processing and backfill

- **`r2-signal-process`** — after ingest, links actor + related MEG ids when inferable; records edges such as `coffee_pairing` where applicable.
- **`meg-backfill-source`** — operator-invoked batches per `(source_system, source_table)`; add a new **adapter branch** in `supabase/functions/meg-backfill-source/index.ts` when onboarding a new table (pattern: `r2:oracle_theses`).

## 6. UI and deep links

Consumers open **`/meg/:uuid`** (operator-workbench) or call **`meg_entity_full_context(p_meg_entity_id)`** to render any catalog type. Pass **UUID** in URLs, not per-app integer ids.

## 7. Cross-database retreat note

When **`r2app`** and **`ray-s-retreat`** share **one** Supabase URL (see workspace [retreat-unified-supabase.md](../../docs/retreat-unified-supabase.md)), run retreat **`meg_entity_id`** migrations against **that** canonical project. The historical “external retreat project” id in older checklists is **legacy**; reconcile envs before applying MEG DDL.

For HTTPS backfill from Eigen into another project, use a **scoped** service-role JWT (e.g. `MEG_RETREAT_SERVICE_ROLE_JWT`), never the generic external key.
