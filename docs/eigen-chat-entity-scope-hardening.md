# Eigen Chat — MEG Entity Scope Hardening Scope of Work

Hardening plan for query-time MEG entity resolution, context injection, and retrieval scoping across `eigen-chat`, `eigen-widget-chat`, and shared retrieval core.

## Threat model (what we defend against)

| Vector                                        | Risk                                        | Mitigation layer                                                |
| --------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| ILIKE wildcard injection in alias/name lookup | Broad DB scans, unexpected matches          | `escapeIlikePattern()` on all user-derived hints                |
| Weak fuzzy auto-resolve                       | Wrong client/property injected into answers | Score floors (`label` ≥ 0.72, `message` ≥ 0.88)                 |
| Invalid / oversized entity scope arrays       | DoS, retrieval bypass                       | UUID validation, max 8 entities (chat), max 100 (retrieve API)  |
| Oversized messages / labels                   | Token burn, latency                         | Env-capped message length; 120-char label cap                   |
| Merged-entity redirect loops                  | Infinite lookup chains                      | 4-hop cap, UUID validation, no self-loops                       |
| Sidecar over-fetch                            | Column leakage, payload bloat               | Explicit column allowlist per sidecar table                     |
| Prompt injection via MEG fields               | LLM instruction override                    | Control-char strip + field/value truncation in prompt formatter |
| Resolution failure taking down chat           | Availability                                | Fail-open to explicit scope; empty context on fetch errors      |
| Session scope drift                           | Follow-up turns lose entity context         | Persist resolved scope back to session (Phase 2)                |
| Unauthenticated entity enumeration            | Public widget probing MEG                   | Entity resolution only in `eigenx` widget mode + member RBAC    |

## Phase 1 — Shipped (PR #328)

- [x] Query-time resolver (`chat-entity-resolver.ts`) with explicit UUID, label, and message hints
- [x] Rich MEG context fetch (sidecars, edges, neighbor hydration, merge redirect)
- [x] Soft retrieval boost vs hard filter (`entity_scope_mode`)
- [x] ILIKE escape, score floors, label sanitization
- [x] Sidecar column allowlist, edge/neighbor caps
- [x] Structured resolution logging in `eigen-chat`
- [x] Response metadata: `entity_scope_applied`, `entity_scope_mode`, `entity_resolution_sources`, `entity_context_count`
- [x] Vitest coverage for resolver, boost, and context formatting

## Phase 2 — This slice

### Ingress validation

- [x] Normalize `entity_scope` to valid UUIDs at every chat entrypoint (`eigen-chat`, `eigen-widget-chat`)
- [x] Normalize session-hydrated entity scope (reject malformed session JSON)
- [x] Widget message length cap (parity with `eigen-chat`)
- [x] Validate alias lookup `meg_entity_id` values before scoring

### Prompt safety

- [x] Strip null bytes and C0 control characters from all entity field text sent to the LLM
- [x] Cap total entity context block size to prevent prompt stuffing

### Session continuity

- [x] Persist auto-resolved entity scope to `eigen_chat_sessions.entity_scope` when resolution adds/changes IDs

### Observability

- [x] Structured resolution logging in `eigen-widget-chat` (match `eigen-chat` fields)

### Retrieval core

- [x] Filter `entity_scope` in `parseEigenRetrieveRequest` to valid UUIDs only

### Tests

- [x] Prompt sanitization unit tests
- [x] Entity scope ingress normalization tests
- [x] Entity context size cap tests

## Phase 3 — Audit slice (shipped)

| Item                                                                                | Status |
| ----------------------------------------------------------------------------------- | ------ |
| Static security scan tests (`tests/eigen/eigen-chat-entity-hardening-scan.test.ts`) | Done   |
| Resolution query budget (`EIGEN_ENTITY_RESOLVE_MAX_HINTS`, default 4, max 8)        | Done   |
| Resolution timeout fail-open (`EIGEN_ENTITY_RESOLVE_TIMEOUT_MS`, default 4500ms)    | Done   |
| MEG neighbor load timeout fail-open (`EIGEN_MEG_NEIGHBOR_LOAD_TIMEOUT_MS`)          | Done   |
| Memory episodes RLS + bounds (service_role writes only)                             | Done   |
| Memory episode topic key UUID validation                                            | Done   |
| Consolidate idempotency + ingress bounds                                            | Done   |
| Normalize explicit scope inside `resolveChatEntityScope`                            | Done   |
| Widget `fetchMegEntityContextForChat` error logging                                 | Done   |
| Widget host context: UUID scope + label length cap                                  | Done   |

## Intelligence slice (shipped)

| Item                         | Notes                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| Session memory recall        | `chat:last_turn:{sessionId}` injected before retrieval snippets                           |
| Governance hydration         | `oracle_run_id` → `oracle_whitespace_runs`; `charter_decision_id` → `charter_decisions`   |
| Cross-encoder rerank on chat | Set `EIGEN_ENABLE_RERANKING=true` (requires Voyage/Cohere keys)                           |
| Mid-session scope update     | POST `eigen-chat` with `{ "scope_update": true, "session_id": "…", "entity_label": "…" }` |

## Phase 3 — Backlog

| Item                                                          | Rationale                                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Policy-scope intersection with MEG entities                   | Requires MEG↔policy tag mapping contract; members currently share MEG read |
| Oracle memory write-back from chat turns                      | Beyond last-turn recall; episode consolidation (E3)                        |
| Rate limit on entity resolution per session                   | Layer on existing chat rate limits if abuse observed                       |
| `eigen-retrieve` entity_scope UUID validation at DB RPC layer | Defense in depth beyond parse layer                                        |
| Multi-query RRF (E2)                                          | See `docs/r2-next-level-roadmap.md`                                        |

## Verification checklist

```bash
npm run typecheck
npx vitest run tests/eigen/chat-entity-resolver.test.ts tests/eigen/chat-entity-context.test.ts tests/eigen/entity-retrieval-boost.test.ts tests/eigen/eigen-x1-e3-hardening-scan.test.ts tests/eigen/memory-episode-keys.test.ts
```

Post-deploy smoke (eigenx member token):

1. Chat with `entity_label: "Acme Corp"` — response includes `entity_scope_applied`, `entity_scope_mode: "boost"`.
2. Chat with explicit UUID — `entity_scope_mode: "filter"`.
3. Follow-up turn without label — session retains resolved scope.
4. Widget eigenx mode — same metadata fields present.
5. Public widget mode — no entity resolution, empty `entity_scope_applied`.

Optional env tuning:

- `EIGEN_ENTITY_RESOLVE_MAX_HINTS` (default `4`, max `8`)
- `EIGEN_ENTITY_RESOLVE_TIMEOUT_MS` (default `4500`, max `15000`)
- `EIGEN_WIDGET_CHAT_MAX_MESSAGE_CHARS` (default `16000`)

## Key files

| File                                                | Role                                   |
| --------------------------------------------------- | -------------------------------------- |
| `src/lib/eigen/chat-entity-resolver.ts`             | Pure resolution logic                  |
| `src/lib/eigen/chat-entity-context.ts`              | Prompt formatting + sanitization       |
| `supabase/functions/_shared/chat-entity-context.ts` | Deno MEG fetch + resolve orchestration |
| `supabase/functions/eigen-chat/index.ts`            | Auth chat handler                      |
| `supabase/functions/eigen-widget-chat/index.ts`     | Widget chat handler                    |
| `supabase/functions/_shared/eigen-retrieve-core.ts` | Retrieval scoring with entity boost    |
