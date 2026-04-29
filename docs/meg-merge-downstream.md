# MEG merge — downstream references

When two MEG entities are merged via [`meg-entities`](../supabase/functions/meg-entities/index.ts) (`action=merge`), the **source** row is set to `status = merged` and `merged_into_id = targetId`.

## Consumer tables (non-exhaustive)

Downstream foreign keys and JSON tags may still point at the **source** UUID until explicitly rewritten:

| Area    | Column / field                                                  | Notes                                                                        |
| ------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Eigen   | `knowledge_chunks.meg_entity_id`, `knowledge_chunks.entity_ids` | Update FK to target; rewrite UUID in `entity_ids` arrays                     |
| Oracle  | `oracle_theses.meg_entity_id`                                   | Point theses at surviving entity                                             |
| Charter | `charter_asset_valuations.meg_entity_id`                        | RESTRICT FK — plan updates before merge if both reference different entities |

## Recommended operator workflow

1. **Inventory:** Query dependent rows for `sourceId` across known tables.
2. **Rewrite:** Batch-update FKs and JSON arrays to `targetId` (or follow `merged_into_id` in application reads).
3. **Merge:** Call merge endpoint with idempotency key.
4. **Verify:** Spot-check retrieval (`entity_scope` includes `targetId`) and domain UIs.

## Future automation (optional slice)

- DB trigger or job: on merge, enqueue a **reference rewrite** job per domain.
- **Read-time resolution:** Application resolves `merged` entities to `merged_into_id` before queries (adds latency; prefer batch rewrite for hot paths).
