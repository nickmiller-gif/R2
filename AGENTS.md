## Repo Purpose

`R2` is the central backend/core system of record for Charter, MEG, Oracle, and Eigen.

## Inherited Workspace Conventions

- This repo follows umbrella conventions from `/Users/nick/Desktop/R2 Complete/AGENTS.md`.
- Prefer execution-first once a plan is approved.
- Keep changes merge-ready with complete follow-through.

## Repo-Specific Priorities

- Default **knowledge-base drivers** wired into this repo: prioritize **CentralR2** (`centralr2-core`), **R2Works** (`operator-workbench`), **R2Chart** (`continuity-nexus`), **R2-IP** (`ip-pulse-point`) for corpus, signals, and Atlas examples. **`r2app`** is the **Ray's Retreat** Lovable application only — optional unless retreat scope is explicit.
- Minimize blast radius for migrations and edge-function changes.
- Preserve governance and security boundaries (RBAC + RLS + publication controls).
- Keep Oracle and Eigen pipelines traceable (idempotency, provenance, policy tags).
- Favor additive migrations and explicit rollout safety.

## Working Rules

- Treat `supabase/migrations` as high-sensitivity; ensure ordering and schema consistency.
- Keep edge functions deterministic and auditable; avoid hidden side effects.
- When changing Oracle flows, update evaluation/calibration persistence together.
- Validate with repo checks (`npm run typecheck`, targeted tests) before merge.
