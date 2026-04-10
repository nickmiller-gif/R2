# Eigen Public Ingest Ops Runbook

This runbook operationalizes the public ingest flow (`eigen-public-sources` + ingest scripts) so site-registry seeds, schedules, and monitoring stay consistent.

## 1) Secrets and Environment

Required runtime secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (if embedding path is enabled)

Required CI/automation secrets:

- `SUPABASE_PROJECT_REF`
- `SUPABASE_ACCESS_TOKEN`

## 2) Source Registry Sync

Primary source of truth is `public.eigen_site_registry` plus the seed migration:

- `supabase/migrations/202604080010_eigen_site_registry_lovable_apps.sql`

Operational rule:

1. Any new Lovable frontend domain must be added to site registry seed SQL in the same PR.
2. Run ingest scripts against updated entries.
3. Confirm records are `status = 'active'` before scheduling.

## 3) Scheduling

Recommended cadence:

- Sitemap ingest: every 6 hours
- RSS ingest: every 30 minutes
- Full re-index: weekly low-traffic window

Suggested scripts:

- `scripts/eigen-public-sitemap-ingest.py`
- `scripts/eigen-public-rss-ingest.py`

## 4) Idempotency and Retry Posture

- Ingest upserts should use stable `(source_system, source_ref)` identifiers.
- Retries should re-use the same source refs to avoid duplicate documents/chunks.
- Failed runs should remain queryable in `ingestion_runs` with terminal status and error metadata.

## 5) Monitoring and Alerts

Track these metrics daily:

- Ingestion success rate (target >= 98%)
- Average ingest duration by source
- New documents/chunks per run
- Error rate by source domain

Alert thresholds:

- 3 consecutive failed runs for a source
- >20% drop in expected new documents/day
- Sustained run duration >2x baseline

## 6) Incident Checklist

1. Identify failing source in `ingestion_runs` and recent logs.
2. Verify source registry status and URL correctness.
3. Re-run a single source ingest in isolation.
4. If parser regressions are found, patch extractor and add a regression test.
5. Backfill missed interval once healthy.

## 7) Change Management

- Keep ingest operational changes in bounded PRs (scheduler, source seed, parser change).
- Pair parser updates with a representative fixture test when possible.
- Update this runbook whenever cadence, alert thresholds, or source classes change.

