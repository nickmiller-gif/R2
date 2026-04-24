# R2 Production Deploy Checklist

Use this checklist for each production deploy of `R2`.

## Required GitHub Actions secrets

- `SUPABASE_PROJECT_REF`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

## Local preflight

1. Export required env vars locally.
2. Run:

```bash
./scripts/production-preflight.sh
```

This runs `npm run check`, verifies Supabase linkability, and prints linked migration state.

## CI/CD behavior

- `ci.yml` runs typecheck, tests, migration guards, and remote drift/typegen checks when Supabase secrets are present.
- `deploy.yml` waits for CI success on the same SHA, then links Supabase, reports R2 migration sync state, and deploys edge functions.

### R2 migrations on a shared Supabase project

The Supabase project `zudslxucibosjwefojtm` hosts multiple apps — R2 (`public`/`public.charter_*`/`public.oracle_*`/etc.) and the `works.*` schema apps deploy through independent channels but share `supabase_migrations.schema_migrations`.

Because the tracking table interleaves migrations from every deploy channel, `supabase db push` from R2's CI would error with `Remote migration versions not found in local migrations directory` every cycle (the `works.*` apps apply via the Supabase Dashboard / their own CI — those rows never appear as `.sql` files in this repo). Using `supabase migration repair --status reverted` to clean them up would just invite the `works.*` CI to re-apply them on its next push — an endless fight between the two channels.

**R2's chosen operating model:**

1. **Migrations apply via the Supabase MCP** (`apply_migration`) out of band — from the operator's local Cursor / review session, or from the Supabase Dashboard after peer review of the SQL. The MCP writes to the same `supabase_migrations.schema_migrations` table so drift checks keep seeing R2's history.
2. **Deploy workflow only handles edge functions** — it reports the migration sync state (warns if any R2 `.sql` file is not yet in the tracking table) but does not attempt `supabase db push`. Edge function deploys are idempotent and safe to run every push.
3. **CI's `lint:supabase:types` remains the safety net.** If a migration you applied via MCP surfaces new columns / enum values in `database.types.ts`, CI will fail the drift check on the next push until the repo's types catch up. Regenerate with `npx supabase@$(bash scripts/supabase-cli-version.sh) gen types typescript --project-id "$SUPABASE_PROJECT_REF" --schema public > database.types.ts`, commit.

When promoting a new R2 migration to production:

```bash
# 1. Add the file under supabase/migrations/ and open a PR.
# 2. Once the PR is approved, apply it via Supabase MCP to the live project
#    (do not wait for merge — the drift check will fail the PR until types
#    reflect the schema change).
# 3. Regenerate database.types.ts and include in the same PR.
# 4. Merge. Deploy runs, reports "All R2 migration files are already applied",
#    and deploys edge functions.
```

### Supabase CLI version is a single source of truth

- All three scripts (`scripts/check-supabase-generated-types.sh`, `scripts/check-supabase-migration-drift.sh`) and the Deploy workflow read the pinned CLI version from `scripts/supabase-cli-version.sh`.
- When bumping the CLI, edit that one file, regenerate `database.types.ts` with the new CLI, commit both together. CI will enforce alignment (a mismatch between the CLI that serialized `database.types.ts` and the CLI the drift check uses will fail `lint:supabase:types`).

### Diagnosing a red Deploy run

1. Open the failing Deploy run — if the `Wait for CI workflow` step is red, the root cause is the CI run on the same SHA. Fix CI first (typecheck, tests, migration guards, types drift, correlation wrap) and re-merge / retry. Deploy will not proceed until CI is green on the same commit.
2. If the `Report R2 migration sync state` step warns about unapplied migration files, apply them via Supabase MCP (`apply_migration`) and re-regenerate types. The next push reporting "All R2 migration files are already applied" confirms sync.
3. If `Deploy edge functions` failed on one function, other functions in the same run were still deployed (the loop is not `set -e` fail-fast). Fix the offending function and re-run the workflow via `workflow_dispatch`; `functions deploy` re-uploads the latest code idempotently.

## Oracle governance + graph worker rollout

When shipping `oracle-ws-pipeline` or graph extraction changes, include:

1. Apply migration `supabase/migrations/202604160002_eigen_governance_audit_log.sql`.
2. Deploy edge functions:
   - `oracle-ws-pipeline`
   - `oracle-graph-extraction-worker`
3. Trigger a manual smoke run:
   - Create/execute an Oracle whitespace run.
   - Verify `oracle_graph_extraction_jobs` receives a `pending` job.
   - Invoke `oracle-graph-extraction-worker` and confirm job transitions to `completed`.
   - Confirm `oracle_whitespace_runs.stage_progress.graph_extraction_job = completed`.
4. Verify governance audit events are written:
   - `run_review_ready`
   - `hypothesis_published`
   - `run_published`
   - `outcome_recorded`

Recommended linked-db checks (when credentials are available):

```bash
supabase db query --linked "select tablename from pg_tables where schemaname='public' and tablename='eigen_governance_audit_log';"
supabase db query --linked "select policyname from pg_policies where schemaname='public' and tablename='eigen_governance_audit_log';"
```

## Current known blocker

- `oracle-read-models` failed in CI deploy because Deno bundling could not resolve two `.js` imports from TypeScript source.
- Fix has been added locally in this workspace by adding runtime-compatible module files under:
  - `src/services/oracle/oracle-db-utils.js`
  - `src/types/oracle/read-models.js`
- Deploy will remain red on GitHub until this change is merged to the canonical `R2` remote branch.
