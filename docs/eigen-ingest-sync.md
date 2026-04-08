# Eigen Incremental Sync

Use incremental sync when you want Eigen to continuously absorb new/changed files.

## Local/manual sync

Script:

- `scripts/eigen-ingest-sync.sh`

Make target:

- `make eigen-ingest-sync`

### Required environment variables

- `SUPABASE_URL`
- `AUTH_BEARER` (member JWT for `eigen-ingest`)
- `INPUT_DIR` (folder to sync)
- `SOURCE_SYSTEM` (namespace for the synced corpus)

### Common optional environment variables

- `SOURCE_REF_PREFIX` (default: `sync`)
- `CHUNKING_MODE` (`hierarchical` or `flat`)
- `POLICY_TAGS` (default for workflow: `eigen_public`)
- `ENTITY_IDS` (comma-separated)
- `EMBEDDING_MODEL`
- `ALLOWED_EXTENSIONS` (default: `.txt,.md,.csv,.pdf,.docx`)
- `MANIFEST_PATH` (default: `<INPUT_DIR>/.eigen-ingest-manifest.json`)
- `PRUNE_MANIFEST_MISSING=true|false`
- `DRY_RUN=true|false`

### Example

```bash
export SUPABASE_URL="https://zudslxucibosjwefojtm.supabase.co"
export AUTH_BEARER="<member-jwt>"
export INPUT_DIR="./knowledge"
export SOURCE_SYSTEM="r2-knowledge"
export SOURCE_REF_PREFIX="main-site"
export POLICY_TAGS="eigen_public,eigenx"

make eigen-ingest-sync
```

## Scheduled GitHub sync

Workflow:

- `.github/workflows/eigen-ingest-sync.yml`

Runs:

- hourly (`17 * * * *`)
- manual dispatch

### GitHub Secrets required

- `SUPABASE_URL`
- `EIGEN_SYNC_AUTH_BEARER`

### GitHub Variables (optional overrides)

- `EIGEN_SYNC_INPUT_DIR` (default: `knowledge`)
- `EIGEN_SYNC_SOURCE_SYSTEM` (default: `eigen-sync`)
- `EIGEN_SYNC_SOURCE_REF_PREFIX` (default: `sync`)
- `EIGEN_SYNC_POLICY_TAGS` (default: `eigen_public`)
- `EIGEN_SYNC_CHUNKING_MODE` (default: `hierarchical`)
- `EIGEN_SYNC_ALLOWED_EXTENSIONS`
- `EIGEN_SYNC_ENTITY_IDS`
- `EIGEN_SYNC_EMBEDDING_MODEL`

## Behavior

- Computes `sha256` per file.
- Ingests only new/changed files.
- Stores sync state in a manifest JSON file.
- Workflow persists manifest using Actions cache to keep incremental state across runs.
