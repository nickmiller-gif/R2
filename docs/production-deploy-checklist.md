# R2 Production Deploy Checklist

Use this checklist for each production deploy of `R2`.

## Required GitHub Actions secrets

- `SUPABASE_PROJECT_REF`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

## Local preflight

1. Export required env vars locally.
2. Run:

```bash
./scripts/production-preflight.sh
```

This runs `npm run check`, verifies Supabase linkability, and prints linked migration state.

## CI/CD behavior

- `ci.yml` runs typecheck, tests, migration guards, and remote drift/typegen checks when Supabase secrets are present.
- `deploy.yml` waits for CI success on the same SHA, then links Supabase, applies migrations, and deploys edge functions.

## Current known blocker

- `oracle-read-models` failed in CI deploy because Deno bundling could not resolve two `.js` imports from TypeScript source.
- Fix has been added locally in this workspace by adding runtime-compatible module files under:
  - `src/services/oracle/oracle-db-utils.js`
  - `src/types/oracle/read-models.js`
- Deploy will remain red on GitHub until this change is merged to the canonical `R2` remote branch.
