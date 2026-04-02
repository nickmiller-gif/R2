# Charter Slice 01: Governance Kernel + Provenance + Audit Read Path

Status: planned (no code ported)

## Scope lock

This slice includes only backend/core primitives needed to stand up:
1. Charter governance kernel domain model and service boundary.
2. Provenance recording primitives tied to governance actions.
3. Audit **read path** (query-side only).

Out of scope:
- write-side audit mutation APIs beyond minimal append hooks used by governance flow
- UI, routes, pages, components
- non-Charter domains (Oracle/Eigen)

## Target file map (destination in `R2`)

### Domain types
- `src/types/charter/governance.ts`
  - canonical governance kernel entities and value objects
- `src/types/charter/provenance.ts`
  - provenance event envelope and actor/source metadata
- `src/types/charter/audit.ts`
  - audit read DTOs and filter/sort shapes

### Services
- `src/services/charter/governance-kernel.service.ts`
  - governance kernel service interface + implementation
- `src/services/charter/provenance.service.ts`
  - provenance append/lookup boundary used by governance kernel
- `src/services/charter/audit-read.service.ts`
  - audit read path orchestration (query-only)
- `src/services/charter/index.ts`
  - explicit exports for Charter services only

### Shared helpers (strictly slice-scoped)
- `src/lib/provenance/hash.ts`
  - deterministic hash helper used for provenance chain checks
- `src/lib/provenance/clock.ts`
  - centralized timestamp helper for provenance records
- `src/lib/provenance/actor.ts`
  - MEG identity-to-actor normalization helper

### Database migrations
- `supabase/migrations/202604020001_charter_governance_kernel.sql`
  - base governance kernel tables and constraints
- `supabase/migrations/202604020002_charter_provenance.sql`
  - provenance table(s), indexes, FK links to governance entities
- `supabase/migrations/202604020003_charter_audit_read_path.sql`
  - read-optimized view(s), indexes, and RLS policies for audit reads

### Tests
- `tests/charter/governance-kernel.service.test.ts`
- `tests/charter/provenance.service.test.ts`
- `tests/charter/audit-read.service.test.ts`
- `tests/charter/audit-read.rls.test.ts`
- `tests/charter/fixtures/governance-fixtures.ts`

## Exact source files to port (from `nickmiller-gif/verified`)

Port only files matching these responsibilities from the legacy repo into the destination map above:
1. Governance kernel domain types/models.
2. Governance kernel service/repository logic.
3. Provenance event schema + append logic + verification helper(s).
4. Audit read query builder/service and read DTO mapping.
5. Existing unit/integration tests that cover (1)-(4).
6. SQL migrations/schema fragments for governance + provenance + audit read views/indexes/RLS.

Do **not** port:
- frontend adapters
- route handlers/controllers not required for backend contracts
- unrelated Oracle/Eigen modules
- broad shared utility packages unless called by the files above

## Supporting dependencies required for this slice

### Schema/migrations
- governance kernel base tables
- provenance append table(s) with immutable append semantics
- audit read view/materialized view (if already used in verified source)
- indexes for actor/time/entity filters
- RLS policies for audit read access boundaries

### Runtime helpers
- deterministic serialization/hashing helper for provenance linkage
- MEG actor normalization helper
- UTC timestamp helper used in provenance envelopes

### Test support
- deterministic fixture builders for governance entities + provenance events
- DB test seed for audit read assertions
- policy tests validating allowed/denied read access paths

## Path/module renaming to keep R2 clean

Apply these renaming rules during import:
1. Replace legacy domain-root aliases with R2-local imports:
   - `@/charter/*` or equivalent -> `src/services/charter/*` and `src/types/charter/*`
2. Move generic-but-slice-specific provenance helpers into:
   - `src/lib/provenance/*`
3. Split mixed read/write audit modules:
   - keep only read concerns in `audit-read.service.ts`
4. Remove any frontend-facing module names (`controller`, `page`, `view`, `component`) from import graph.
5. Keep service entrypoint explicit via `src/services/charter/index.ts`.

## Exact import plan (minimal blast radius)

1. **Inventory pass (no code copy):** map legacy files to the target file map above.
2. **Migration pass:** add three ordered SQL migrations only.
3. **Types pass:** import/normalize domain types (`governance`, `provenance`, `audit`).
4. **Service pass:** import governance kernel, provenance, and audit-read services only.
5. **Helper pass:** add only required provenance helpers.
6. **Test pass:** import and adapt only slice tests + fixtures.
7. **Validation pass:** run tests + migration checks; confirm no frontend or cross-domain leakage.

Completion gate:
- all imported files map to this document
- no additional modules outside this slice appear in diff
- audit path remains read-only in this slice
