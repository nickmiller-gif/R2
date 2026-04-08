# Eigen Bulk Ingest

Use this to load large sets of files into Eigen reliably.

Script:

- `scripts/eigen-ingest-bulk.sh`

Make target:

- `make eigen-ingest-bulk`

## Required environment variables

- `SUPABASE_URL` (example: `https://<project>.supabase.co`)
- `AUTH_BEARER` (member JWT accepted by `eigen-ingest`)
- `INPUT_DIR` (directory containing files to ingest)
- `SOURCE_SYSTEM` (logical source namespace)

## Optional environment variables

- `SOURCE_REF_PREFIX` (default: `bulk`)
- `CHUNKING_MODE` (`hierarchical` or `flat`, default: `hierarchical`)
- `POLICY_TAGS` (comma-separated; example: `eigen_public` or `eigen_public,eigenx`)
- `ENTITY_IDS` (comma-separated)
- `EMBEDDING_MODEL` (default uses backend setting)
- `ALLOWED_EXTENSIONS` (default: `.txt,.md,.csv,.pdf,.docx`)
- `DRY_RUN=true` (prints plan, no uploads)

## Example

```bash
export SUPABASE_URL="https://zudslxucibosjwefojtm.supabase.co"
export AUTH_BEARER="<member-jwt>"
export INPUT_DIR="/path/to/knowledge"
export SOURCE_SYSTEM="raysretreat"
export SOURCE_REF_PREFIX="site-content"
export POLICY_TAGS="eigen_public"

make eigen-ingest-bulk
```

## Notes

- Each file gets a stable idempotency key derived from its `source_ref`.
- The script reports per-file success/failure and returns non-zero if any file fails.
- File extraction supports `.pdf` and `.docx` in addition to text formats.
- For continuous updates with incremental change detection, use `scripts/eigen-ingest-sync.sh` (documented in `docs/eigen-ingest-sync.md`).
