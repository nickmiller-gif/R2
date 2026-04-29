# EigenX retrieval roadmap (R2)

This document captures the **next retrieval slices** beyond the current production path in [`supabase/functions/_shared/eigen-retrieve-core.ts`](../supabase/functions/_shared/eigen-retrieve-core.ts): embed query → `match_knowledge_chunks` → heuristic scoring (`scoreCandidate`) → token budget (`selectChunksWithinBudget`).

## Current state

- **Vector stage:** Postgres RPC `match_knowledge_chunks` (HNSW cosine, policy/entity filters, temporal validity).
- **Rerank:** Default-on heuristic rerank over ANN candidates; `rerank: false` skips heuristics and uses raw similarity ordering.
- **Budget:** Chunk count + optional token cap with strata weights.
- **Provenance:** Optional per-chunk provenance block for callers.
- **Decomposition field:** `retrieval_runs.decomposition` today stores request metadata (scopes, site knobs), not executed sub-queries.

## Slice A — Query decomposition (EigenX-style)

**Goal:** Turn one user query into multiple retrieval units (sub-queries or facet filters), run embeddings/RPC (or filtered SQL) for each, merge with dedupe by `chunk_id`, then apply a single shared budget pass.

**Contract:** Extend `retrieval_runs.decomposition` (or parallel JSON column) with a versioned shape, e.g. `{ "version": 1, "sub_queries": [...], "merge": "union_dedupe" }`.

**Implementation options (pick one per rollout):**

1. **Rules-only:** Regex / keyword templates for known product intents (cheap, deterministic).
2. **LLM planner:** Small model proposes 2–5 sub-queries; strict JSON schema + timeout + fallback to single-query path.
3. **Hybrid:** Rules first; LLM only when confidence low.

**Guardrails:** Same KOS capability bundle and policy tags as today; cap sub-query count; total ANN budget across sub-queries ≤ configurable ceiling.

## Slice B — Stronger rerank (optional second stage)

**Goal:** Improve ordering after ANN without blowing latency budgets.

**Options:** Cross-encoder scoring on top-K (e.g. K ≤ 40), or provider rerank API, gated by env `EIGEN_RERANK_STAGE=heuristic|cross_encoder|off`.

**Guardrails:** Feature flag per site; fail-open to current heuristic path on error.

## Slice C — Policy rule loading performance

**Today:** [`resolveEigenCapabilityAccess`](../supabase/functions/_shared/eigen-policy-engine.ts) loads all rows from `eigen_policy_rules` each call.

**Near-term:** Short TTL in-process cache (rules rarely change mid-minute).

**Later:** Scoped query `.in('policy_tag', [...])` once rule semantics are proven safe for partial loads, or materialized read model keyed by `policy_tag` + revision.

## References

- ADR-001 Phase 3 slices: [`docs/ADR-001-headless-backend-pluggable-frontends.md`](./ADR-001-headless-backend-pluggable-frontends.md)
- KOS / anonymous boundary: [`docs/ADR-003-anonymous-kos-surface-policy.md`](./ADR-003-anonymous-kos-surface-policy.md)
