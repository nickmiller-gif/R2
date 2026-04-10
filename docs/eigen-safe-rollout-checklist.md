# Eigen Safe Rollout Checklist (Multi-Repo)

Use this checklist to enable the new cross-repo Eigen integrations without flipping all apps at once.

## Rollout model

- Keep new ingest routes disabled by default.
- Enable one repo at a time.
- Verify that repo in production-like traffic before enabling the next.
- Keep rollback as an env toggle, not a code revert.

For copy/paste env templates, see `docs/eigen-rollout-env-examples.md`.

## Global prerequisites

- Apply R2 migrations that add site registry entries:
  - `supabase/migrations/202604100001_eigen_site_registry_health_supplement_tr.sql`
  - `supabase/migrations/202604100002_eigen_site_registry_project_darling.sql`
- Ensure `R2` site seeds include new sites (`scripts/eigen-site-registry-seed.sql`).
- Ensure R2 edge functions are deployed and healthy (`eigen-ingest`, widget/chat functions).

## Per-repo env checklist

### `r2app`

- `VITE_EIGEN_WIDGET_HOST` = widget host URL
- `VITE_EIGEN_API_BASE` = `https://<r2-project>.supabase.co/functions/v1`
- `VITE_USE_LEGACY_EIGENX_CHAT`:
  - `"true"` (or unset) keeps legacy chat
  - set `"false"` only when ready to switch to widget path

### `project-darling`

- `VITE_EIGEN_WIDGET_HOST` = widget host URL
- `VITE_EIGEN_API_BASE` = `https://<r2-project>.supabase.co/functions/v1`
- `VITE_ENABLE_EIGEN_WIDGET`:
  - `"false"` (or unset) disables widget
  - `"true"` enables widget

### `ip-insights-hub` (edge function: `ip-router`)

- `ENABLE_R2_EIGEN_INGEST`:
  - `"false"` (or unset) disables outbound ingest
  - `"true"` enables outbound ingest
- `R2_EIGEN_INGEST_BEARER_TOKEN` = member/service token accepted by R2 ingest
- Optional: `R2_EIGEN_INGEST_ENDPOINT` (defaults to R2 production endpoint)
- Optional: `R2_EIGEN_DEFAULT_POLICY_TAGS` (comma-separated)

### `centralr2-core` (edge functions: `property-lookup`, `rental-analysis`)

- `ENABLE_R2_EIGEN_INGEST`
- `R2_EIGEN_INGEST_BEARER_TOKEN`
- Optional: `R2_EIGEN_INGEST_ENDPOINT`
- Optional: `R2_EIGEN_DEFAULT_POLICY_TAGS`

### `hpseller` (edge function: `db-write`)

- `ENABLE_R2_EIGEN_INGEST`
- `R2_EIGEN_INGEST_BEARER_TOKEN`
- Optional: `R2_EIGEN_INGEST_ENDPOINT`
- Optional: `R2_EIGEN_DEFAULT_POLICY_TAGS`

### `health-supplement-tr` (export script)

Required for script `npm run eigen:export`:

- `HST_SUPABASE_URL` (or `SUPABASE_URL`)
- `HST_SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`)
- `R2_EIGEN_INGEST_BEARER_TOKEN`
- Optional: `R2_EIGEN_INGEST_ENDPOINT`
- Optional: `HST_EXPORT_LIMIT` (default `100`)

## Staged enablement sequence

### Stage 0 — Baseline (no production behavior change)

1. Deploy code everywhere with all new toggles disabled.
2. Run preflight checks:
   - `R2`: `npm run typecheck`, `npm run test`
   - each frontend repo: `npm run lint` and `npm run build`
3. Verify no runtime regression with toggles disabled.

### Stage 1 — R2 config + registry

1. Apply R2 migrations and confirm `eigen_site_registry` rows exist.
2. Confirm `config/eigen-sites.json` contains `health-supplement-tr` and `project-darling`.
3. Confirm allowlists include new domains where needed.

### Stage 2 — Ingest producers one by one

Enable and verify in this order:

1. `ip-insights-hub` (`ENABLE_R2_EIGEN_INGEST=true`)
2. `centralr2-core` (`ENABLE_R2_EIGEN_INGEST=true`)
3. `hpseller` (`ENABLE_R2_EIGEN_INGEST=true`)
4. `health-supplement-tr` run `npm run eigen:export` manually, then schedule automation

Verification for each repo:

- Trigger one representative workflow.
- Confirm request latency remains acceptable.
- Confirm ingest logs show success and no retry exhaustion spikes.
- Confirm chunks are queryable in R2 by `source_system` and `source_ref`.

### Stage 3 — UI path switches

1. `r2app`: set `VITE_USE_LEGACY_EIGENX_CHAT=false` only after widget smoke tests pass.
2. `project-darling`: set `VITE_ENABLE_EIGEN_WIDGET=true` only when UI is approved.

## Smoke tests per enablement

- Chat/widget appears and responds.
- Auth transition works (public to eigenx where applicable).
- No cross-site data leakage in prompt evals.
- No new 5xx spikes in app edge functions.

## Fast rollback

- For ingest producers: set `ENABLE_R2_EIGEN_INGEST=false`.
- For `r2app`: set `VITE_USE_LEGACY_EIGENX_CHAT=true`.
- For `project-darling`: set `VITE_ENABLE_EIGEN_WIDGET=false`.

These rollbacks do not require a new deploy if your platform supports runtime env updates.
