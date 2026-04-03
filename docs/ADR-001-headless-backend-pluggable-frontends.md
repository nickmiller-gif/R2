# ADR-001: R2 as Headless Backend with Pluggable Frontend Domains

**Status:** Accepted
**Date:** 2026-04-02
**Deciders:** Nick Miller

## Context

The R2 ecosystem currently lives across two repositories:

**raysretreat** — a monolithic React/Vite SPA that switches product surfaces by hostname, containing 100+ Supabase edge functions, 10 kernel packages, 13 shared Oracle intelligence modules, full frontend components/pages/routes, and an extensive test/eval suite. It has 13,786 commits and 307 branches. Oracle, Eigen/EigenX, and Charter are deeply interwoven with the frontend shell.

**R2** — a clean backend-only repo created to be the canonical backend/core. It already has Charter Slice 01 ported (governance kernel + provenance + audit read path) with migrations, services, types, and tests. It is connected to a single Supabase project (`zudslxucibosjwefojtm`) and has a Claude Code Agent CI pipeline.

The goal is to make R2 the **brain and spine** of the ecosystem — a headless backend that Oracle, Eigen, and Charter run on — so that different frontend applications (Lovable-built UIs, mobile apps, third-party integrations) can plug in without touching the core intelligence and governance logic.

### Forces at Play

1. **Oracle is the most code-complete system** in raysretreat: 15+ edge functions, 13 shared modules (reweighting, verification, whitespace contracts, temporal analysis, gap detection, evidence freshness, opportunity modeling), a service layer, page components, and an eval harness with 13+ audit passes.

2. **EigenX has a thorough architectural plan** (EIGENX_KOS_UPGRADE_PLAN.md) defining a 5-phase upgrade from retrieval assistant to Knowledge Operating System, but implementation is earlier-stage — primarily `eigenPolicy.ts` and pipeline wiring.

3. **Charter has the cleanest extraction path** — Slice 01 is already ported to R2 with a proven pattern (types → services → migrations → tests).

4. **The raysretreat substrate packages** (`@r2/entity-graph`, `@r2/rights-engine`, `@r2/obligations-engine`, `@r2/provenance`, `@r2/contributions`, `@r2/evals`, `@r2/payouts`, `@r2/royalties`, `@r2/audit`, `@r2/events`) define foundational contracts that Oracle/Charter/Eigen depend on.

5. **Frontend coupling is the primary extraction barrier.** Services in raysretreat import from `src/components/`, route files reference page components, and the hostname-based domain switching bakes product surfaces into the SPA shell.

6. **The existing R2 plan enforces minimum blast radius** — one slice at a time, no frontend code, no cross-domain leakage, stop conditions if boundaries are violated.

## Decision

Structure R2 as a **three-layer headless backend** with a strict **API boundary** that any frontend can consume.

### Layer 1: Foundation (shared primitives)

```
src/
  lib/
    primitives/          ← event envelope, idempotency, correlation IDs
    money/               ← integer minor units, rounding catalog
    temporal/            ← UTC clock, validity windows, timezone standard
    identity/            ← MEG canonical identity, actor normalization
    provenance/          ← hash, clock, actor (already exists)
    policy/              ← typed policy AST (replaces free-form *_json)
```

These are the `core-primitives` recommended by ARCHITECTURE_REVIEW.md. Every service above this layer imports from here. No service-to-service imports at this layer.

### Layer 2: Domain Engines (Oracle, Charter, Eigen)

```
src/
  services/
    charter/             ← governance kernel, provenance, audit (Slice 01 done)
    oracle/              ← intelligence core: reweighting, verification,
                            whitespace contracts, temporal analysis,
                            gap detection, evidence freshness, fusion
    eigen/               ← retrieval pipeline, context assembly,
                            tool routing, memory management
  types/
    charter/             ← (exists)
    oracle/              ← oracle domain types
    eigen/               ← eigen domain types
    shared/              ← cross-domain event types, entity references

supabase/
  functions/
    charter-*/           ← charter edge functions
    oracle-*/            ← oracle edge functions (activation, feed, ingest,
                            master, publish, predict, score-llm, thesis,
                            verification-runner, refresh, redteam, etc.)
    eigen-*/             ← eigen edge functions
    _shared/             ← shared CORS, auth guards, edge utilities

  migrations/
    YYYYMMDD_charter_*.sql
    YYYYMMDD_oracle_*.sql
    YYYYMMDD_eigen_*.sql
    YYYYMMDD_foundation_*.sql
```

Each domain engine:
- Owns its tables, views, and RLS policies
- Emits typed events through the shared event envelope
- Exposes a service interface (not raw DB queries)
- Has its own edge functions that compose the service layer
- Has its own test suite and eval harness

Cross-domain rules:
- Oracle can read Charter governance state (read-only dependency)
- Eigen can call Oracle intelligence and Charter governance (read-only)
- Charter has no dependency on Oracle or Eigen
- All cross-domain access goes through service interfaces, never direct table reads

### Layer 3: API Surface (pluggable frontend boundary)

```
supabase/
  functions/
    api-router/          ← unified edge function router
                            (or per-domain routers: charter-router,
                             oracle-router, eigen-router)
```

The API surface is the **only thing frontends touch.** It exposes:
- RESTful endpoints via edge functions (already the pattern in raysretreat)
- Supabase Realtime subscriptions for live updates
- RLS-protected direct Supabase client reads for authenticated queries

Frontend applications (Lovable-built or otherwise) consume this surface and bring their own:
- Components, pages, routes
- Domain-specific UI logic
- Hostname/routing configuration

## Options Considered

### Option A: Monorepo Migration (move everything into R2 including frontends)

| Dimension | Assessment |
|-----------|------------|
| Complexity | High — reproduces raysretreat's coupling problem |
| Cost | High — massive merge, hard to review |
| Scalability | Low — frontends remain coupled to backend releases |
| Team familiarity | High — same patterns as raysretreat |

**Pros:** Single repo, single CI, easy cross-references.
**Cons:** Defeats the purpose. Frontend coupling persists. Different frontend apps (Lovable, mobile, etc.) would conflict. Raysretreat already proved this doesn't scale.

### Option B: Headless Backend + Pluggable Frontends (chosen)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — clear layer boundaries, incremental extraction |
| Cost | Medium — phased migration follows proven slice pattern |
| Scalability | High — any frontend connects via API surface |
| Team familiarity | Medium — new pattern but R2 repo already demonstrates it |

**Pros:** Clean separation. Multiple frontends possible. Backend can evolve independently. Claude Code Agent can operate on backend without frontend noise. Lovable can rebuild UIs freely without touching intelligence/governance logic.
**Cons:** Requires discipline at the API boundary. Some raysretreat code will need refactoring during extraction (separating service logic from frontend adapters). Two-repo workflow for full-stack changes.

### Option C: Microservices Split (separate repos per domain)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Very High — service mesh, independent deployments, distributed tracing |
| Cost | Very High — operational overhead for a solo/small team |
| Scalability | Very High — but premature at current scale |
| Team familiarity | Low — new operational model |

**Pros:** Maximum isolation. Independent scaling per domain.
**Cons:** Massive operational overhead. Supabase is already the shared backend — splitting it into multiple projects creates data consistency nightmares. Not justified at current team size.

## Trade-off Analysis

The key trade-off is between **extraction speed** and **architectural cleanliness.**

Option B (chosen) optimizes for both by following the slice pattern already proven with Charter Slice 01: extract one bounded piece at a time, verify it works in isolation, then move to the next. This is slower than a bulk copy but prevents the coupling problems that made raysretreat unwieldy.

The main risk is that Oracle's 15+ edge functions and 13 shared modules have internal dependencies that don't cleanly separate from the raysretreat frontend. Mitigation: the `shared/oracle/` directory in raysretreat is already backend-only (`.mjs` and `.ts` files with no frontend imports), so the core intelligence logic should extract cleanly. The edge functions follow a standard pattern (auth guard → service call → response) that maps directly to R2's structure.

## Consequences

**What becomes easier:**
- Spinning up new frontend surfaces (Lovable rebuilds, mobile apps, partner integrations) without touching backend
- Running Claude Code Agent against clean backend logic without frontend noise
- Testing and evaluating Oracle/Eigen intelligence in isolation
- Enforcing governance contracts (Charter) independently of UI
- Independent deployment cadences for frontend and backend

**What becomes harder:**
- Full-stack changes require coordinating across repos
- Frontend developers need to understand the API surface contract
- Some raysretreat patterns (direct Supabase client queries from components) need refactoring to go through the service layer

**What we'll need to revisit:**
- Whether the single Supabase project is sufficient as Oracle and Eigen edge functions scale
- Whether Eigen's retrieval pipeline needs its own vector store or can share the main Postgres
- Rate limiting and auth patterns at the API surface for multiple frontend consumers
- The `@r2/events` package contract — currently Charter-focused, needs Oracle and Eigen event types

## Phased Extraction Plan

### Phase 0: Foundation Primitives (prerequisite for all domains)
Extract from raysretreat and/or define fresh in R2:
- Event envelope schema (correlation ID, idempotency key, causation ID)
- MEG identity primitives (entity resolution, alias handling)
- Temporal standard (UTC clock source, validity windows)
- Shared edge function utilities (`_shared/` CORS, auth guards)

### Phase 1: Charter Completion (extend what's started)
- **Slice 02:** Charter adapter hardening + event emission
- **Slice 03:** Charter-asset deep linking (entity graph integration)
- **Slice 04:** Charter edge functions (from raysretreat `supabase/functions/`)

### Phase 2: Oracle Core (the big extraction)
- **Slice 05:** Oracle shared intelligence core (`shared/oracle/` — 13 modules)
  - `oracleReweightingExecutionCore.mjs`
  - `oracleVerificationCore.mjs`
  - `masterWhitespaceContracts.ts`
  - `retrievalContract.ts`
  - Temporal analysis (`temporalDiff`, `temporalDrift`)
  - Gap detection (`gapScanner`, `predictiveGapScoring`)
  - Evidence management (`evidenceFreshness`, `feedRescore`)
  - `multiHorizonTiming.ts`, `opportunityModel.ts`, `crossRunDiff.ts`
- **Slice 06:** Oracle service layer (`src/services/oracle/`)
- **Slice 07:** Oracle types and domain model
- **Slice 08:** Oracle edge functions (15+ functions, grouped by responsibility):
  - Ingestion: `oracle-ingest`, `oracle-feed`
  - Intelligence: `oracle-master`, `oracle-activation`, `oracle-predict`
  - Scoring: `oracle-score-llm`, `oracle-thesis`
  - Publishing: `oracle-publish`, `oracle-refresh`
  - Verification: `oracle-verification-runner`, `oracle-redteam`
  - Operations: `oracle-operator-cockpit`, `oracle-opportunity-review-worker`
  - Temporal: `temporal-oracle`
  - Schema: `oracle-code-schema-index`
  - Decision: `decision-oracle-v2`
- **Slice 09:** Oracle evals harness (`evals/oracle/harness/` + `evals/oracle/rag/`)
- **Slice 10:** Oracle migrations (tables, indexes, RLS)

### Phase 3: Eigen/EigenX (build on Oracle + Charter)
- **Slice 11:** Eigen policy and routing (`shared/eigenPolicy.ts` + service layer)
- **Slice 12:** EigenX retrieval pipeline (per EIGENX_KOS_UPGRADE_PLAN.md phases 0-2)
  - Multi-stage retrieval: vector → filter → rerank
  - Query decomposition
  - Context budget allocator
- **Slice 13:** EigenX tool routing and memory management
- **Slice 14:** Eigen edge functions

### Phase 4: Substrate Packages (foundational contracts)
- **Slice 15:** `@r2/entity-graph` — canonical entity/edge model
- **Slice 16:** `@r2/rights-engine` + `@r2/obligations-engine`
- **Slice 17:** `@r2/provenance` (extend beyond Charter-scoped provenance)
- **Slice 18:** `@r2/events` (extend beyond Charter event types)
- **Slice 19:** `@r2/evals` (generalized eval framework)
- **Slice 20:** Financial engines (`@r2/payouts`, `@r2/royalties`, `@r2/contributions`, `@r2/audit`)

### Phase 5: Integration Hardening
- Cross-domain contract tests (Oracle reads Charter governance, Eigen calls Oracle)
- End-to-end API surface tests
- Eval baseline for Oracle intelligence in R2 context
- Performance benchmarks for edge function latency

## Operational Process (per slice, unchanged from plan.md)

1. Select one bounded primitive from raysretreat.
2. Define R2 target contract first (schema + service + types).
3. Implement migrations and service scaffolding.
4. Add/extend tests.
5. Document boundaries and rollout notes.
6. Run checks.
7. Open PR and merge when verified.

## Stop Conditions (unchanged from plan.md)

Pause merge if any of the following occurs:
- Frontend/module-shell code appears in diff
- Unrelated domain files outside declared slice are added
- Migrations include tables/views outside declared slice
- Tests require broad shared imports not in slice map

## Action Items

1. [ ] Align on this ADR — accept, revise, or reject
2. [ ] Implement Phase 0 foundation primitives
3. [ ] Continue Charter extraction (Slices 02-04)
4. [ ] Begin Oracle shared core extraction (Slice 05)
5. [ ] Define API surface contract format for frontend consumers
6. [ ] Create first Lovable frontend repo that consumes R2 API
