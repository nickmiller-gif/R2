# Eigen ingest producers — who calls `eigen-ingest` and public corpus (`eigen_public`)

Anonymous / pre-login chat (`eigen-chat-public`) retrieves only chunks whose **`policy_tags`** include **`eigen_public`** (after `normalizeCorpusPolicyTags` in `eigen-ingest`). This page lists every producer in the **R2 Ecosystem** workspace that POSTs to `eigen-ingest` or builds the same JSON payload.

## R2 (canonical backend)

| Producer | Path | Policy behavior |
|----------|------|-------------------|
| Ingest edge | `supabase/functions/eigen-ingest/index.ts` | `normalizeCorpusPolicyTags` in `_shared/eigen-policy.ts`: include **`eigen_public`** → public corpus; otherwise **`eigenx`** is enforced as the internal baseline plus your tags. |
| URL fetch → ingest | `supabase/functions/eigen-fetch-ingest/index.ts` | Always **`["eigen_public"]`** then forwards to `eigen-ingest`. |
| Public sitemap / RSS | `scripts/eigen-public-sitemap-ingest.py`, `scripts/eigen-public-rss-ingest.py`, `scripts/eigen_public_ingest_http.py` | Call **`eigen-fetch-ingest`** only → public. |
| Public corpus runner | `scripts/eigen-public-corpus-ingest.sh` | Wires sitemap/RSS + optional file sync with default **`eigen_public`** for the file branch (`eigen-ingest-sync.sh`). |
| File sync | `scripts/eigen-ingest-sync.sh` | **`POLICY_TAGS`** env (multipart). Empty → normalizes to **internal**; set `eigen_public` for public drops. |
| Bulk files | `scripts/eigen-ingest-bulk.sh` | Same as sync. |
| Seed | `scripts/eigen-seed.sh` | Explicit **`eigen_public`** vs **`eigenx`** per seeded document. |
| Dev UI | `apps/eigen-chat/src/App.tsx` | User selects public vs eigenx tier → `policy_tags` set accordingly. |

## App repos (Supabase edge → R2)

| App | Path | Default policy intent |
|-----|------|-------------------------|
| IP Insights Hub | `ip-insights-hub/supabase/functions/ip-router/index.ts` | **`ip-confidential`**, **`ip-analysis`**, **`ip-landscape`** + **`R2_EIGEN_DEFAULT_POLICY_TAGS`**. Do not add **`eigen_public`** unless the payload is intentionally safe for anonymous retrieval. |
| Central R2 Core | `centralr2-core/supabase/functions/_shared/eigen-ingest.ts` | **`centralr2-core-internal`**, **`centralr2-knowledge`** + env/event tags. Internal-first; use env only for deliberate public marketing. |
| HP Seller | `hpseller/supabase/functions/_shared/eigen-ingest.ts` | **`hpseller-internal`**, **`seller-workflow`** + env/event tags. Internal-first. |
| Health Supplement TR | `health-supplement-tr/scripts/export-trends-to-r2.mjs` | **`eigen_public`** + domain tags so shared trends are visible to **`eigen-chat-public`**. |

## R2 TypeScript adapters (`src/adapters/`)

Used by tooling/tests and future server paths; they call `createEigenIngestClient` with explicit `policy_tags` / `visibilityPolicyTags`:

| Adapter | Default visibility / tags |
|---------|----------------------------|
| `r2app/eigen-r2app-adapter.ts` | Default **`public`** → includes **`eigen_public`**. |
| `raysretreat/eigen-raysretreat-adapter.ts` | Default **`public`** → **`eigen_public`**. |
| `health-supplement-tr/eigen-health-supplement-adapter.ts` | Default **`public`** (pass **`eigenx`** for operator-only). |
| `centralr2-core/eigen-centralr2-adapter.ts` | **`eigenx`** (internal narratives). |
| `ip-insights-hub/eigen-ip-adapter.ts` | IP-internal tags; optional `defaultPolicyTags` merge. |

## Operational check

From `R2/` with `SUPABASE_SERVICE_ROLE_KEY` in `.env.supabase.local`:

```bash
set -a && source .env.supabase.local && set +a && ./scripts/verify-eigen-ecosystem-ingest.sh
```

The script prints per-`source_system` **eigen_public** chunk counts.
