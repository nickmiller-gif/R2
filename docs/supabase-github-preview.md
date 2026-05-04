# Supabase GitHub Preview + shared migration history

## Symptom

The GitHub check **Supabase Preview** (Supabase GitHub app) can fail with:

```text
Remote migration versions not found in local migrations directory.
```

This is the same class of issue described in [production-deploy-checklist.md](production-deploy-checklist.md) for `supabase db push` on the shared project **`zudslxucibosjwefojtm`**.

## Root cause

1. **One Postgres project, many deploy channels** — R2 ships SQL from `supabase/migrations/*.sql`, while `works.*` and other apps sometimes apply SQL via the Supabase Dashboard or their own CI. All channels write rows into **`supabase_migrations.schema_migrations`**.
2. **Version keys do not all originate in this repo** — Dashboard / other CLIs may record a migration `version` (e.g. 14-digit timestamps) that never appears as a filename in `nickmiller-gif/R2`.
3. **Supabase Preview** compares the linked database’s migration history to the PR’s local `supabase/migrations/` tree. Any remote-only version key causes the error above.

## What we do in R2

- **Placeholder migrations** — For remote-only `version` values that must exist for CLI / Preview matching, we add **no-op** SQL files whose numeric prefix equals that `version`, with documentation pointing here. They are safe on fresh databases (they only run `SELECT 1`) and are no-ops on environments where the version row already exists (Supabase records the version when the file is applied in order on empty DBs; on existing shared DBs the row already exists — `db push` / preview uses the file list for **reconciliation**, not re-applying every statement on prod).
- **Operational alternative** — If placeholders are undesirable, disable **Supabase Preview** for this repository or attach previews to a **dedicated empty preview project** so no foreign migration rows appear.

## Related

- [production-deploy-checklist.md](production-deploy-checklist.md) — R2 deploy model (no `db push` from CI to shared prod; MCP / dashboard apply for schema).
