# R2 — Central Backend/Core

R2 is the clean backend/core repository for the revised ecosystem.

It is the shared backend backbone for:

- **Charter** (governance layer)
- **Oracle** (intelligence/opportunity layer)
- **Eigen** (shared runtime primitives where relevant)

## Core Architecture Principles

1. **One central Supabase project** is the only shared backend and system of record.
2. **MEG** is the canonical identity layer.
3. **Charter** is the governance layer.
4. **Oracle** is the intelligence/opportunity layer.
5. **Eigen** reuses shared backend/runtime primitives where appropriate.
6. **Frontend domains live in separate repositories**.
7. This repository contains **backend/core only** (no frontend app shell).
8. Changes should follow **minimum blast radius**.

## Scope of This Repository

Included:

- Supabase schema and function lifecycle
- Shared backend services and libraries
- Shared backend types
- Backend tests
- Migration/import planning docs

Excluded:

- UI components
- Frontend pages/routes
- Legacy multi-domain frontend shell

## Base Structure

```text
supabase/
  migrations/
  functions/
src/
  services/
  lib/
  types/
tests/
docs/
plan.md
```

## Current State

Domain slices are ported with CI verification (`npm run check`):

| Domain         | Edge functions (indicative)                                                                                                                                                                               | Tests |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| **Charter**    | governance, entities, rights, obligations, evidence, payouts, decisions, roles, provenance, audit-read, asset-valuations                                                                                  | ✅    |
| **MEG**        | entities, aliases, edges                                                                                                                                                                                  | ✅    |
| **Oracle**     | signals, theses, evidence-items, source-packs, thesis-evidence-links, whitespace-runs, read-models                                                                                                        | ✅    |
| **Eigen**      | ingest, fetch-ingest, retrieve, chat, chat-public, widget session/chat, knowledge-chunks, retrieval-runs, memory, tools, source inventory, public sources, oracle outbox drain, autonomous-capture-ingest | ✅    |
| **Foundation** | documents, asset-registry                                                                                                                                                                                 | ✅    |

There are **45** deployed function entrypoints under `supabase/functions/` (each `*/index.ts` excluding `_shared`). Most require a valid JWT; **eigen-chat-public** is rate-limited and unauthenticated by design. Run `npm run test` for the current test count. No `@/` alias imports.

## Next priorities

1. Harden Oracle operator surfaces (narrow PATCH bodies, align rescore with versioned supersede path)
2. Expand observability baseline (correlation-id propagation and structured logging across remaining edge functions)
3. EigenX retrieval depth (query decomposition, optional rerank stage) — see [`docs/eigenx-retrieval-roadmap.md`](./docs/eigenx-retrieval-roadmap.md)

EigenX/KOS operator surfaces, capability bundles, and contract tests are shipped; see [`plan.md`](./plan.md) and [`docs/ADR-003-anonymous-kos-surface-policy.md`](./docs/ADR-003-anonymous-kos-surface-policy.md) for boundaries.

## Supabase Client Factory Pattern

- Preferred edge-function pattern is module-scope `const supabaseClients = createSupabaseClientFactory()`, then `supabaseClients.user(req)` for caller-scoped reads and `supabaseClients.service()` for operator writes.
- Convenience shortcuts `getSupabaseClient(req)` and `getServiceClient()` are allowed where they reduce boilerplate; both delegate to the same default factory under the hood.
- Shared Deno helper lives at `supabase/functions/_shared/supabase.ts`.
- Node/Vitest helper mirrors the same contract at `src/lib/supabase/create-client-factory.ts` so test harnesses and tooling can inject clients without coupling to Deno globals.

## CI Secrets For Remote Supabase Checks

When both of these GitHub Actions repository secrets are set, `npm run check` also runs migration drift and generated-types verification against the linked Supabase project:

- `SUPABASE_PROJECT_REF` (for this repo: `zudslxucibosjwefojtm`)
- `SUPABASE_ACCESS_TOKEN` (personal token from Supabase account settings)

If either secret is missing (for example on a fork pull request), CI still runs typecheck, tests, and local guards, but **skips** remote drift and typegen the same way as a local machine without credentials.

See [`plan.md`](./plan.md) for the full slice roadmap.

For multi-repo Eigen rollout safety, see [`docs/eigen-safe-rollout-checklist.md`](./docs/eigen-safe-rollout-checklist.md).

For which repos tag **`eigen_public`** (anonymous retrieval) vs internal **`eigenx`**, see [`docs/eigen-ingest-producers.md`](./docs/eigen-ingest-producers.md).

For production release procedure and preflight, see [`docs/production-deploy-checklist.md`](./docs/production-deploy-checklist.md).

For Supabase per-PR preview DB tradeoffs and rollout phases, see [`docs/supabase-pr-preview-evaluation.md`](./docs/supabase-pr-preview-evaluation.md).
