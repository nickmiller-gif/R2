# Public folder (Eigen `eigen_public`)

Put files here that should be ingested into the **public** corpus (alongside sitemap pages and RSS/news links).

Supported extensions match `eigen-ingest-sync` (e.g. `.txt`, `.md`, `.csv`, `.pdf`, `.docx`).

## Ingest

From the repo root, with `SUPABASE_URL` and `AUTH_BEARER` set:

```bash
export EIGEN_PUBLIC_FILES_DIR="knowledge/public"
./scripts/eigen-public-corpus-ingest.sh
```

Or run the full public pipeline (sitemap + RSS + this folder):

```bash
export EIGEN_PUBLIC_SITEMAP_URLS="https://yoursite.com/sitemap.xml"
export EIGEN_PUBLIC_RSS_URLS="https://yoursite.com/news/feed/"
export EIGEN_PUBLIC_FILES_DIR="knowledge/public"
./scripts/eigen-public-corpus-ingest.sh
```

See `docs/eigen-public-corpus.md` for environment variables and CI.
