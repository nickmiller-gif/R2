# Contributing to R2

## Database migrations

Migration files live in `supabase/migrations/`.

### Filename convention

Use **`YYYYMMDDHHMM_snake_case.sql`**:

- **`YYYYMMDDHHMM`** — twelve digits: UTC date (`YYYYMMDD`) plus a four-digit ordering key (`HHMM`). Prefer wall-clock time when creating the migration; if multiple files land the same minute, bump the last migration’s `HHMM` by one minute so the prefix stays unique.
- **`snake_case`** — lowercase words separated by underscores describing the change.

Examples: `202605031430_add_deadletter_replay_rpc.sql`

The migration sanity check (`npm run lint:migrations`) enforces a twelve-digit numeric prefix and snake*case suffix matching `^[0-9]{12}*[a-z0-9_]+\.sql$`.

Do not edit migration SQL after it has been applied to any shared environment (checksum drift). Fix forward with a new migration. See `R2-Operational-Pitfalls.md` (Pitfall C3).

After a migration that adds tables, columns, or RPCs is **applied** to the linked Supabase project, regenerate types so CI passes:

```bash
export SUPABASE_ACCESS_TOKEN=…   # account token, not anon
export SUPABASE_PROJECT_REF=zudslxucibosjwefojtm   # or your preview ref
./scripts/regen-database-types.sh
```

That script uses the Supabase CLI version pinned in `scripts/supabase-cli-version.sh` (same as CI).

To verify committed types match the linked project (same gate as CI when secrets are set):

```bash
export SUPABASE_ACCESS_TOKEN=…
export SUPABASE_PROJECT_REF=…
REQUIRE_SUPABASE_REMOTE_CHECKS=true npm run lint:supabase:types
```

If `npx supabase@…` hangs on your machine, download the matching release binary from [supabase/cli releases](https://github.com/supabase/cli/releases) and point the check at it:

```bash
export SUPABASE_GEN_TYPES_BIN=/path/to/supabase   # pinned binary, e.g. v2.89.0 darwin arm64 tarball
REQUIRE_SUPABASE_REMOTE_CHECKS=true npm run lint:supabase:types
```

### Verify locally

```bash
npm run lint:migrations
```
