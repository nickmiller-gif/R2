## Repo Purpose

`R2` is the central backend/core system of record for Charter, MEG, Oracle, and Eigen.

## Inherited Workspace Conventions

- This repo follows umbrella conventions from `/Users/nick/Desktop/R2 Complete/AGENTS.md`.
- Prefer execution-first once a plan is approved.
- Keep changes merge-ready with complete follow-through.

## Repo-Specific Priorities

- Minimize blast radius for migrations and edge-function changes.
- Preserve governance and security boundaries (RBAC + RLS + publication controls).
- Keep Oracle and Eigen pipelines traceable (idempotency, provenance, policy tags).
- Favor additive migrations and explicit rollout safety.

## Working Rules

- Treat `supabase/migrations` as high-sensitivity; ensure ordering and schema consistency.
- Keep edge functions deterministic and auditable; avoid hidden side effects.
- When changing Oracle flows, update evaluation/calibration persistence together.
- Validate with repo checks (`npm run typecheck`, targeted tests) before merge.
