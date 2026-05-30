# Eigen Rollout Env Examples

Copy/paste templates for staged rollout. Keep these in your secret manager, not in committed `.env` files.

## `r2app`

```env
VITE_EIGEN_WIDGET_HOST=https://eigen-d3x.pages.dev
VITE_EIGEN_API_BASE=https://zudslxucibosjwefojtm.supabase.co/functions/v1
# Safe default keeps existing chat:
VITE_USE_LEGACY_EIGENX_CHAT=true
```

Switch to shared widget path:

```env
VITE_USE_LEGACY_EIGENX_CHAT=false
```

## `project-darling`

```env
VITE_EIGEN_WIDGET_HOST=https://eigen-d3x.pages.dev
VITE_EIGEN_API_BASE=https://zudslxucibosjwefojtm.supabase.co/functions/v1
# Safe default disabled:
VITE_ENABLE_EIGEN_WIDGET=false
```

Enable widget:

```env
VITE_ENABLE_EIGEN_WIDGET=true
```

## `ip-insights-hub` edge env (`ip-router`)

```env
ENABLE_R2_EIGEN_INGEST=false
R2_EIGEN_INGEST_ENDPOINT=https://zudslxucibosjwefojtm.supabase.co/functions/v1/eigen-ingest
R2_EIGEN_INGEST_BEARER_TOKEN=<r2-ingest-token>
R2_EIGEN_DEFAULT_POLICY_TAGS=ip-confidential,ip-analysis
```

Enable ingest:

```env
ENABLE_R2_EIGEN_INGEST=true
```

## `centralr2-core` edge env (`property-lookup`, `rental-analysis`)

```env
ENABLE_R2_EIGEN_INGEST=false
R2_EIGEN_INGEST_ENDPOINT=https://zudslxucibosjwefojtm.supabase.co/functions/v1/eigen-ingest
R2_EIGEN_INGEST_BEARER_TOKEN=<r2-ingest-token>
R2_EIGEN_DEFAULT_POLICY_TAGS=centralr2-core,governance
```

Enable ingest:

```env
ENABLE_R2_EIGEN_INGEST=true
```

## `hpseller` edge env (`db-write`)

```env
ENABLE_R2_EIGEN_INGEST=false
R2_EIGEN_INGEST_ENDPOINT=https://zudslxucibosjwefojtm.supabase.co/functions/v1/eigen-ingest
R2_EIGEN_INGEST_BEARER_TOKEN=<r2-ingest-token>
R2_EIGEN_DEFAULT_POLICY_TAGS=hpseller,seller-workflow
```

Enable ingest:

```env
ENABLE_R2_EIGEN_INGEST=true
```

## `smartplrx-trend-tracker` export runner

Same shape as health supplement export; uses the **smartplrx** `source_system` and optional internal tier:

```bash
SPLX_SUPABASE_URL=<trendpulse-project-url>
SPLX_SUPABASE_SERVICE_ROLE_KEY=<trendpulse-service-role>
R2_EIGEN_INGEST_BEARER_TOKEN=<member-or-service-jwt-for-r2>
ENABLE_R2_EIGEN_INGEST=true
# Optional: force internal corpus only
# SPLX_EIGEN_VISIBILITY=eigenx
npm run eigen:export
```

## `health-supplement-tr` export runner

```env
HST_SUPABASE_URL=<health-supplement-project-url>
HST_SUPABASE_SERVICE_ROLE_KEY=<health-supplement-service-role>
R2_EIGEN_INGEST_ENDPOINT=https://zudslxucibosjwefojtm.supabase.co/functions/v1/eigen-ingest
R2_EIGEN_INGEST_BEARER_TOKEN=<r2-ingest-token>
ENABLE_R2_EIGEN_INGEST=false
HST_EXPORT_LIMIT=100
HST_EIGEN_INGEST_TIMEOUT_MS=12000
HST_EIGEN_MAX_BODY_CHARS=60000
HST_EIGEN_DRY_RUN=true
```

Real run:

```env
ENABLE_R2_EIGEN_INGEST=true
HST_EIGEN_DRY_RUN=false
```

---

## R2 Supabase edge (`eigen-chat`, `eigen-retrieve`, `eigen-widget-chat`)

Top-tier retrieval (E1 rerank + E2 multi-query RRF):

```env
EIGEN_TOP_TIER_RETRIEVAL=false
EIGEN_ENABLE_RERANKING=false
EIGEN_MULTI_QUERY_FUSION=false
EIGEN_MULTI_QUERY_LLM=false
EIGEN_MULTI_QUERY_MAX_QUERIES=3
```

Oracle intelligence in entity-scoped chat:

```env
EIGEN_ORACLE_SIGNAL_CHAT_MIN_SCORE=65
EIGEN_ORACLE_SIGNAL_MEMORY_PROMOTION=false
EIGEN_WORKSPACE_MEMORY_OWNER_ID=<uuid>
```

Staging recommendation:

```env
EIGEN_TOP_TIER_RETRIEVAL=true
```

MEG 1-hop neighbor retrieval boost (X1; boost mode only):

```env
EIGEN_MEG_NEIGHBOR_BOOST=0.035
# Disable graph neighbor boost:
# EIGEN_MEG_NEIGHBOR_BOOST=0
# Loader bounds (fail-open on timeout; max 5000 ms / 1000 edges):
EIGEN_MEG_NEIGHBOR_LOAD_TIMEOUT_MS=1200
EIGEN_MEG_NEIGHBOR_EDGE_LIMIT=500
```

Memory episode consolidation cron (E3):

```env
EIGEN_MEMORY_EPISODES_CRON_TOKEN=<cron-bearer>
EIGEN_MEMORY_EPISODES_SERVICE_TOKEN=<service-role-jwt>
```

Vault secret for pg_cron: `eigen_memory_episodes_cron_bearer` (service-role JWT).
Run `select public.schedule_eigen_memory_episodes_cron();` after the secret exists.

---

For staged sequence and rollback plan, see `docs/eigen-safe-rollout-checklist.md`.
