# R2 Codebase Overview

> Auto-generated reference document. Keep this in sync with major structural changes.

---

## What It Is

R2 is a **headless Supabase backend** — no frontend lives here. It is the shared backbone for multiple product frontends (SmartPLRx, CentralR2, R2 Chart/Charter, R2 Control) that consume R2's API surface from separate Lovable repos.

---

## Key Technologies

| Technology | Role |
|---|---|
| **Supabase** | Single shared Postgres DB + Edge Functions runtime + Auth (JWT via JWKS) |
| **TypeScript (ESM)** | All service/type/library code in `src/` |
| **Deno** | Edge Function runtime (inside `supabase/functions/`) |
| **Vitest** | Test runner |
| **pgvector + pg_trgm** | Postgres extensions for vector similarity search (Eigen RAG) |
| **jose (jsr:@panva/jose)** | Offline JWT verification at Edge Function boundaries |
| **Zod** | Request body validation at edge boundaries |

---

## Repository Layout

```
R2/
├── src/                        # TypeScript backend services and types
│   ├── services/               # Service factories per domain
│   │   ├── charter/            # Governance: governance-kernel, entities, rights, obligations, evidence, payouts, decisions, roles, provenance, audit-read, asset-valuations
│   │   ├── oracle/             # Intelligence: signals, theses, evidence-items, source-packs, thesis-evidence-links, whitespace, service-layer, read-models, publication
│   │   ├── eigen/              # Knowledge OS: knowledge-chunks, retrieval-runs, tool-capabilities, memory-entries, policy-engine, whitespace-intelligence, autonomous-capture
│   │   ├── meg/                # Master Entity Graph: entities, aliases, edges
│   │   ├── foundation/         # Asset registry, shared foundation services
│   │   ├── documents/          # Document service
│   │   └── provenance/         # Hash-chain provenance (shared/agnostic)
│   ├── types/                  # Domain type definitions (camelCase, pure TS)
│   │   ├── charter/, oracle/, eigen/, meg/, shared/
│   ├── lib/                    # Pure computation libraries (no DB access)
│   │   ├── oracle/             # Scoring, verification, whitespace, temporal, evidence-freshness, opportunity, cross-run-diff, retrieval-contract
│   │   ├── provenance/         # Hash utilities + clock
│   │   ├── temporal/           # Time window helpers
│   │   ├── identity/           # Entity refs, aliases, MEG identity
│   │   ├── edge/               # Correlation ID, idempotency key utilities
│   │   └── eigen/              # Eigen-specific lib helpers
│   ├── adapters/               # Adapter layer
│   └── index.ts                # Top-level barrel export for entire service layer
│
├── supabase/
│   ├── migrations/             # Additive-only SQL migrations (numbered by date)
│   └── functions/              # Deno Edge Function entrypoints (one per `*/index.ts`, excluding `_shared`)
│       ├── _shared/            # Shared modules used across functions
│       │   ├── auth.ts         # guardAuth() — offline JWT verification via jose/JWKS
│       │   ├── supabase.ts     # DI-friendly Supabase client factory
│       │   ├── cors.ts         # CORS headers
│       │   ├── validate.ts     # Zod validation + idempotency key enforcement
│       │   ├── correlation.ts  # x-correlation-id / x-idempotency-key headers
│       │   ├── rbac.ts         # Role-based access control (imports from roles.ts)
│       │   ├── roles.ts        # Canonical ROLE_HIERARCHY + CharterRole type
│       │   ├── eigenx-scope.ts # EigenX policy scope defaults/clamping
│       │   └── ...             # Other shared helpers
│       ├── charter-*/          # 11 Charter edge functions
│       ├── oracle-*/           # 5 Oracle edge functions
│       ├── eigen-*/            # 15 Eigen edge functions (incl. autonomous-capture-ingest)
│       ├── meg-*/              # 3 MEG edge functions
│       └── foundation-*/       # 2 Foundation edge functions
│
├── tests/                      # Vitest test suites mirroring domain structure
│   ├── charter/, oracle/, eigen/, meg/, foundation/, contracts/, documents/
│
├── apps/
│   ├── eigen-chat/             # (app shell)
│   └── eigen-widget/           # Embeddable JS widget (deployed to Cloudflare Pages)
│
├── docs/                       # ADRs, runbooks, integration guides
├── scripts/                    # Lint/CI guard scripts
├── database.types.ts           # Supabase-generated Postgres type bindings
└── package.json                # npm scripts: check, typecheck, test, lint:imports, lint:migrations
```

---

## Domain Layers

### 1. Foundation
Shared primitives used by all domains: documents, asset registry, SHA-256 hash-chain provenance, identity.

### 2. Charter
Governance kernel. Manages entities, rights, obligations, evidence, payouts, decisions, roles. Every mutation is provenance-tracked.

### 3. Oracle
Intelligence layer. Ingests signals → forms theses → links evidence → runs whitespace analysis → produces outcomes and publication-ready read models.

### 4. MEG (Master Entity Graph)
Canonical identity layer. All entities, aliases, and relationships between domain objects are anchored here.

### 5. Eigen / EigenX
Knowledge Operating System. Ingests documents, chunks them with vectors, runs retrieval (RAG), supports chat sessions, manages a policy engine and tool capability registry. Has a public-facing embeddable chat widget deployed to Cloudflare Pages.

---

## Universal Service Pattern

Every domain service follows this exact contract:

```typescript
// DB row (snake_case) — maps 1:1 to Postgres
interface DbXxxRow { /* snake_case fields */ }

// Domain entity (camelCase) — used inside the service layer
interface XxxEntity { /* camelCase fields */ }

// Mapper
function rowToEntity(row: DbXxxRow): XxxEntity { /* ... */ }

// Postgres port
interface XxxDb {
  insertXxx(row: DbXxxRow): Promise<DbXxxRow>;
  findXxxById(id: string): Promise<DbXxxRow | null>;
  queryXxx(filter: Partial<DbXxxRow>): Promise<DbXxxRow[]>;
}

// Service API
interface XxxService {
  createXxx(input: Omit<XxxEntity, 'id' | 'createdAt'>): Promise<XxxEntity>;
  getXxxById(id: string): Promise<XxxEntity | null>;
  listXxx(filter?: XxxFilter): Promise<XxxEntity[]>;
}

// Factory
function createXxxService(db: XxxDb): XxxService { /* impl */ }
```

- Types in `src/types/<domain>/`
- Services in `src/services/<domain>/`
- Tests in `tests/<domain>/` with fixtures in `tests/<domain>/fixtures/`
- Barrel exports in `src/index.ts`, `src/services/<domain>/index.ts`, `src/types/<domain>/index.ts`

---

## Edge Function Pattern

Every edge function follows this structure:

```typescript
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { guardAuth } from "../_shared/auth.ts";
import { createClient } from "../_shared/supabase.ts";
import { extractRequestMeta } from "../_shared/correlation.ts";

Deno.serve(async (req) => {
  // 1. CORS preflight
  if (req.method === "OPTIONS") return handleCors();

  // 2. Authenticate (offline JWT via jose + JWKS)
  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  // 3. Authorize (role-gated writes via charter_user_roles)

  // 4. Validate request body (Zod)

  // 5. Require Idempotency-Key for mutations (POST/PATCH)

  // 6. Create Supabase client via DI factory
  const supabase = createClient(req);
  const { correlationId, idempotencyKey } = extractRequestMeta(req);

  // 7. Call service → return JSON
});
```

Key headers: `x-correlation-id`, `x-idempotency-key`.  
`eigen-chat-public` is the only unauthenticated function (rate-limited instead).

---

## CI / Quality Gates

`npm run check` runs all gates in sequence:

```bash
npm run typecheck        # tsc --noEmit (src/, tests/, _shared/retrieval-budget.ts)
npm run test             # vitest run
npm run lint:imports     # scripts/check-banned-imports.sh
npm run lint:migrations  # scripts/check-migrations.sh
npm run lint:supabase:drift   # scripts/check-supabase-migration-drift.sh
npm run lint:supabase:types   # scripts/check-supabase-generated-types.sh
```

Requires `npm install` first (`node_modules` is gitignored, `package-lock.json` is tracked).

---

## Key Design Decisions

| Decision | Rule |
|---|---|
| No frontend code | Never — frontend lives in separate Lovable repos |
| Additive-only migrations | No DROP or destructive ALTER |
| Minimum blast radius | One bounded slice per PR, no cross-domain changes |
| Auth | Offline JWT verification via `jose` against Supabase JWKS |
| Idempotency | `Idempotency-Key` header required for all POST/PATCH mutations |
| RLS | Postgres Row-Level Security enforced in addition to Edge Function checks |
| Serialization | `analysis_json` stored via `JSON.stringify/parse` — keep types JSON-serializable |
| Views | Security-invoker views use `WITH (security_invoker = true)` |

See [`ADR-001`](./ADR-001-headless-backend-pluggable-frontends.md) and [`ADR-002`](./ADR-002-edge-function-auth-jose-jwks.md) for architectural decision records.
