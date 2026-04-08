# Knowledge Drop Zone

Place source files here for Eigen ingestion/sync.

Supported formats:

- `.txt`
- `.md`
- `.csv`
- `.pdf`
- `.docx`

Suggested structure:

```text
knowledge/
  public/
  eigenx/
  domains/
    raysretreat/
    centralr2/
    r2app/
```

For **public-only** ingest together with sitemap + RSS (news feeds), see `docs/eigen-public-corpus.md` and `make eigen-public-corpus`.

Run incremental sync:

```bash
export SUPABASE_URL="https://<project>.supabase.co"
export AUTH_BEARER="<member-jwt>"
export INPUT_DIR="./knowledge"
export SOURCE_SYSTEM="r2-knowledge"
export SOURCE_REF_PREFIX="knowledge"
export POLICY_TAGS="eigen_public,eigenx"
make eigen-ingest-sync
```

Run one-time bulk ingest:

```bash
export SUPABASE_URL="https://<project>.supabase.co"
export AUTH_BEARER="<member-jwt>"
export INPUT_DIR="./knowledge"
export SOURCE_SYSTEM="r2-knowledge"
export SOURCE_REF_PREFIX="knowledge"
export POLICY_TAGS="eigen_public,eigenx"
make eigen-ingest-bulk
```
