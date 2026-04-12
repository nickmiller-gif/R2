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

All initial domain slices have been ported and verified:

| Domain | Services | Edge Functions | Tests |
|--------|----------|---------------|-------|
| **Charter** | governance-kernel, provenance, audit-read, entities, evidence, obligations, payouts, decisions, rights, roles | 10 functions | ✅ |
| **MEG** | entities, aliases, edges | 3 functions | ✅ |
| **Oracle** | profile-run, signals, theses, evidence-items, source-packs, thesis-links, outcomes | 5 functions | ✅ |
| **Eigen** | knowledge-chunks, retrieval-runs, tool-capabilities, memory-entries | 4 functions | ✅ |
| **Foundation** | asset-registry, documents | 2 functions (+ 2 shared) | ✅ |

All 24 edge functions require JWT authentication. All 481 tests pass. No `@/` alias imports.

## Next priorities

1. Oracle publication + governance boundary (internal vs operator-facing objects)
2. MEG identity handshake contracts across domains
3. Supabase client DI factory pattern
4. Supabase migration drift CI check

See [`plan.md`](./plan.md) for the full slice roadmap.
