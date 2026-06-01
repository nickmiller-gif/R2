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

## Learned User Preferences

- When a plan/spec is attached, do not edit the plan file — work the pre-created to-dos in order and finish all of them without stopping for confirmation.
- Expects commit + merge on request (e.g. "can you merge?"); operate with broad autonomy when told "do whatever is best", but still hold or ask before production-risky / destructive actions.
- Prefers surgical, high-signal changes (small, reviewable audit/cleanup passes) over broad churn.
- When building Eigen corpus/vector integrations, prioritize full context coverage for Eigen over minimal wiring.
- Ray Voice (`ray_voice` store) should mold Eigen to sound like Ray in responses — persona/tone addendum, distinct from factual corpus retrieval.

## Learned Workspace Facts

- GitHub remote `github.com/nickmiller-gif/R2`; default branch `main`. Standard flow: feature branch → PR → CI → squash-merge → sync `main`.
- CI `.github/workflows/ci.yml` (Node 22) runs `npm ci` → lint → typecheck → test → build; `deploy.yml` deploys edge functions on push to `main`.
- Required PR merge gates are "CI / Typecheck · Test · Guards" and "Supabase Preview" (the latter is non-blocking, reports `UNSTABLE`, and skips when a PR has no migrations).
- Edge functions are not covered by `tsc`/Vitest (Deno + esm.sh imports); validate them with ESLint, the repo guard scripts, and review against `database.types.ts`.
- Eigen's frontend is intended to be domain-agnostic with a chat-dominant layout per domain.
- Eigen OpenAI vector integration uses a multi-store registry + fan-out search (`eigen-corpus-search.ts`), gated by `EIGEN_VECTOR_STORE_RETRIEVAL=true`; OpenAI store categories do not map 1:1 to R2 `policy_tags`.
- Eigen access model: public chat is hard-pinned to `eigen_public`; EigenX scopes retrieval via `policy_tags` + `eigen_policy_access_grants`.
- OpenAI vector stores registered for Eigen are public-readable; `ray_voice` feeds persona addendum only.
- `knowledge_chunks` pgvector HNSW index must use `vector_cosine_ops` to match cosine distance in `match_knowledge_chunks`; repo migration guard blocks `vector_ip_ops`.
- If pgvector retrieve fails but OpenAI corpus hits exist, `eigen-chat` / `eigen-chat-public` degrade gracefully to OpenAI context instead of returning 400.
