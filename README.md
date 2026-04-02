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

## Current Import Target

The first extraction target is:
- **Charter governance kernel + provenance + audit read path**

See:
- [`plan.md`](./plan.md)
- [`docs/imports/charter-slice-01-governance-kernel.md`](./docs/imports/charter-slice-01-governance-kernel.md)

No additional slices should be imported until this first slice is fully verified.
