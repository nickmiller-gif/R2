# Public Eigen corpus (sitemap + news + files)

Use this when you want **public** answers to draw from:

1. **Website pages** discovered via **sitemap(s)**  
2. **Recent news / blog** via **RSS or Atom** feeds  
3. **Static files** in a folder (committed or uploaded in CI), ingested with `eigen_public` tags  

All three go through the same policy tag **`eigen_public`**. URLs still must pass server **`EIGEN_FETCH_ALLOWLIST`**.

## One-shot script (recommended)

`scripts/eigen-public-corpus-ingest.sh` runs every stage you configure via environment variables.

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Project URL |
| `AUTH_BEARER` | JWT for a user with **member** (or higher) role |
| `EIGEN_PUBLIC_SITEMAP_URLS` | Comma-separated sitemap URLs (optional) |
| `EIGEN_PUBLIC_RSS_URLS` | Comma-separated RSS/Atom feed URLs (optional) |
| `EIGEN_PUBLIC_FILES_DIR` | Path to a directory of files, e.g. `knowledge/public` (optional) |

**File sync naming** (only when `EIGEN_PUBLIC_FILES_DIR` is set):

| Variable | Default |
|----------|---------|
| `EIGEN_PUBLIC_FILES_SOURCE_SYSTEM` | `public-site-files` |
| `EIGEN_PUBLIC_FILES_SOURCE_REF_PREFIX` | `public` |
| `EIGEN_PUBLIC_FILES_POLICY_TAGS` | `eigen_public` |

**Tuning:**

- `EIGEN_FETCH_INGEST_DELAY_SEC` — delay between URL fetches (sitemap + RSS); default `0.35`
- `EIGEN_PUBLIC_SITEMAP_MAX_URLS`, `EIGEN_PUBLIC_SITEMAP_MAX_DEPTH` — sitemap script
- `EIGEN_PUBLIC_RSS_MAX_ITEMS_PER_FEED`, `EIGEN_PUBLIC_RSS_MAX_URLS` — RSS script

**Make target:**

```bash
export SUPABASE_URL="https://YOUR.supabase.co"
export AUTH_BEARER="<jwt>"
export EIGEN_PUBLIC_SITEMAP_URLS="https://example.com/sitemap.xml"
export EIGEN_PUBLIC_RSS_URLS="https://example.com/blog/feed/"
export EIGEN_PUBLIC_FILES_DIR="knowledge/public"
make eigen-public-corpus
```

## Individual scripts

- `scripts/eigen-public-sitemap-ingest.py` — sitemap-only  
- `scripts/eigen-public-rss-ingest.py` — feeds-only  
- `scripts/eigen-ingest-sync.sh` — directory-only (set `POLICY_TAGS=eigen_public`)  

## GitHub Actions

Workflow: `.github/workflows/eigen-public-corpus.yml`  
Schedule: weekly (Monday 06:00 UTC) + **workflow_dispatch**.

**Secrets** (same as incremental sync):

- `SUPABASE_URL`
- `EIGEN_SYNC_AUTH_BEARER` — member JWT

**Variables** (set at least one or the job only prints a skip notice):

| Variable | Example |
|----------|---------|
| `EIGEN_PUBLIC_SITEMAP_URLS` | `https://raysretreat.com/sitemap.xml` |
| `EIGEN_PUBLIC_RSS_URLS` | `https://raysretreat.com/news/feed/` |
| `EIGEN_PUBLIC_FILES_DIR` | `knowledge/public` |

Optional: `EIGEN_FETCH_INGEST_DELAY_SEC` (default `0.35`).

When `EIGEN_PUBLIC_FILES_DIR` is set, the workflow caches `.cache/eigen-public-files-manifest.json` for incremental file sync across runs.
