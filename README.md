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

| Domain | Edge functions (indicative) | Tests |
|--------|----------------------------|-------|
| **Charter** | governance, entities, rights, obligations, evidence, payouts, decisions, roles, provenance, audit-read, asset-valuations | ✅ |
| **MEG** | entities, aliases, edges | ✅ |
| **Oracle** | signals, theses, evidence-items, source-packs, thesis-evidence-links, whitespace-runs | ✅ |
| **Eigen** | ingest, fetch-ingest, retrieve, chat, chat-public, widget session/chat, knowledge-chunks, retrieval-runs, memory, tools, source inventory, public sources, oracle outbox drain | ✅ |
| **Foundation** | documents, asset-registry | ✅ |

There are **36** deployed function entrypoints under `supabase/functions/`. Most require a valid JWT; **eigen-chat-public** is rate-limited and unauthenticated by design. Run `npm run test` for the current test count. No `@/` alias imports.

## Next priorities

1. Oracle publication + governance boundary (internal vs operator-facing objects)
2. MEG identity handshake contracts across domains
3. Supabase client DI factory pattern
4. Supabase migration drift CI check

See [`plan.md`](./plan.md) for the full slice roadmap.
