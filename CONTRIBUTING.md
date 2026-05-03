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

### Verify locally

```bash
npm run lint:migrations
```
