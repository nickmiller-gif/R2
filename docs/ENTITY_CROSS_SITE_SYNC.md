# Cross-site entity sync (R2-IP ↔ R2 Works)

Canonical identity and field snapshots live on **Eigen MEG** (`meg_entity_projections`).

## Event types

| Event                 | Emitter                                | Processor                                                 |
| --------------------- | -------------------------------------- | --------------------------------------------------------- |
| `entity_field_update` | `ip_pulse_point`, `operator_workbench` | `r2-signal-process` → `apply_meg_entity_projection_patch` |
| `entity_updated`      | `r2_widget` (projection emit)          | Observe-only (no re-apply)                                |

## Feature flag

- Eigen Edge: `ENABLE_ENTITY_CROSS_SITE_SYNC` — set to `false` to disable apply/emit in `r2-signal-process`.
- Frontends: `VITE_ENABLE_ENTITY_CROSS_SITE_SYNC` — set to `false` to skip emit/read overlay.

Default: enabled when unset.

## Rollout

1. Apply migration `20260527120000_meg_entity_projections.sql` on Eigen.
2. Deploy `r2-signal-process` on Eigen.
3. Deploy IP edges: `entity-field-update-emit`, `eigen-entity-projection-read`.
4. Publish `operator-workbench` and `ip-pulse-point` with env flags on.
5. Smoke: edit client in Works → projection row updates → IP admin list shows overlay (requires shared `meg_entity_id` via Tower/MEG resolve).

## Smoke checklist

- [ ] Works `updateClient` emits `entity_field_update` when `meg_entity_source_refs` exists.
- [ ] IP admin edit invokes `entity-field-update-emit` after local update.
- [ ] Eigen SQL: `select * from meg_entity_projections order by updated_at desc limit 5;`
- [ ] Duplicate `source_revision` returns `duplicate_revision` (no double-apply).
- [ ] `entity_updated` feed rows do not re-trigger patch apply.

## Pitfalls

- [Pitfall A2, A3]: HMAC/bearer drift blocks IP emit — run `kb-four-bridge-sync-secrets.mjs`.
- IP clients without Tower `meg_entity_id` cannot cross-sync until MEG bridge resolves a UUID.
