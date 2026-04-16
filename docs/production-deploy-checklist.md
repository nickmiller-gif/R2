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
- `deploy.yml` waits for CI success on the same SHA, then links Supabase, applies migrations, and deploys edge functions.

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
