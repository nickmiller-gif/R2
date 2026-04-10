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

For staged sequence and rollback plan, see `docs/eigen-safe-rollout-checklist.md`.
