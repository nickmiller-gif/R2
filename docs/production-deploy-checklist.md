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

### Supabase CLI version is a single source of truth

- All three scripts (`scripts/check-supabase-generated-types.sh`, `scripts/check-supabase-migration-drift.sh`) and the Deploy workflow read the pinned CLI version from `scripts/supabase-cli-version.sh`.
- When bumping the CLI, edit that one file, regenerate `database.types.ts` with the new CLI, commit both together. CI will enforce alignment (a mismatch between the CLI that serialized `database.types.ts` and the CLI the drift check uses will fail `lint:supabase:types`).

### Diagnosing a red Deploy run

1. Open the failing Deploy run — if the `Wait for CI workflow` step is red, the root cause is the CI run on the same SHA. Fix CI first (typecheck, tests, migration guards, types drift, correlation wrap) and re-merge / retry. Deploy will not proceed until CI is green on the same commit.
2. If the CI gate passed and the `Deploy migrations` step failed, the `supabase db push` error message pinpoints which migration failed — read the `::group::Deploying` headers; fix locally, and re-deploy.
3. If `Deploy edge functions` failed on one function, other functions in the same run were still deployed (the loop is not `set -e` fail-fast). Fix the offending function and re-run the workflow via `workflow_dispatch`; `supabase db push` is idempotent and `functions deploy` re-uploads the latest code.

### Catching up after a stall

If multiple merges landed while deploys were red, the next successful deploy's `supabase db push` will apply every missing migration in order (ascending migration-name sort). No manual catch-up required.

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
