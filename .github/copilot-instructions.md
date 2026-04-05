# Copilot Agent Instructions for R2

## Architecture

R2 is a **headless Supabase backend** — no frontend code lives here. Frontend domains (SmartPLRx, CentralR2, R2 Chart/Charter, R2 Control) are separate Lovable repos that consume R2's API surface.

### Layers
| Layer | What |
|-------|------|
| Foundation | Shared primitives: provenance, documents, asset registry, identity, temporal |
| Charter | Governance kernel: entities, rights, obligations, evidence, payouts, decisions, roles |
| Oracle | Intelligence: signals, theses, evidence items, source packs, thesis-evidence links |
| Eigen | Knowledge OS: knowledge chunks, retrieval runs, tool capabilities, memory entries |

## R2 Service Pattern (mandatory)

Every service follows this exact pattern:

```typescript
// Types in src/types/<domain>/
interface Entity { /* camelCase fields */ }
interface EntityFilter { /* optional filter fields */ }

// DB row in src/services/<domain>/
interface DbEntityRow { /* snake_case fields */ }
function rowToEntity(row: DbEntityRow): Entity { /* mapper */ }

// Ports
interface EntityDb {
  insertEntity(row: DbEntityRow): Promise<DbEntityRow>;
  findEntityById(id: string): Promise<DbEntityRow | null>;
  queryEntities(filter: Partial<DbEntityRow>): Promise<DbEntityRow[]>;
  // ...
}

// Service
interface EntityService {
  createEntity(input: Omit<Entity, 'id' | 'createdAt'>): Promise<Entity>;
  getEntityById(id: string): Promise<Entity | null>;
  listEntities(filter?: EntityFilter): Promise<Entity[]>;
  // ...
}

// Factory
function createEntityService(db: EntityDb): EntityService { /* impl */ }
```

## Hard Rules

1. **No frontend code** — ever, in any PR
2. **One bounded slice per PR** — do not cross domain boundaries
3. **Additive migrations only** — never DROP or ALTER destructively
4. **snake_case in DB rows, camelCase in domain entities**
5. **Run \`npm run check\` before claiming completion** (typecheck + test)
6. **Update barrel exports** when adding new public types/services
7. **Update tests** when changing public behavior
8. **Minimum blast radius** — small, reviewable, reversible changes

## File Locations

| What | Where |
|------|-------|
| Types | `src/types/<domain>/` |
| Services | `src/services/<domain>/` |
| Tests | `tests/<domain>/` |
| Test fixtures | `tests/<domain>/fixtures/` |
| Migrations | `supabase/migrations/` |
| Edge functions | `supabase/functions/<domain>-<resource>/index.ts` |
| Shared edge utils | `supabase/functions/_shared/` |
| Barrel exports | `src/index.ts` + `src/services/<domain>/index.ts` + `src/types/<domain>/index.ts` |

## Supabase Security Rules (critical)

1. **Never expose service role keys** to clients or frontend code
2. **Edge Functions must authenticate** — call \`guardAuth(req)\` from \`_shared/auth.ts\` which verifies JWT identity (not just token presence)
3. **Edge Functions must authorize** — check user roles/permissions before any service-role write
4. **No service-role client for user-triggered writes** unless the endpoint enforces RBAC explicitly and is reviewed
5. **Defense in depth** — enforce permissions with Postgres RLS policies where possible; don't rely solely on Edge Function checks
6. **Validate request bodies at the boundary** using Zod or equivalent — never trust client input
7. **Require \`Idempotency-Key\` header** for POST/PATCH mutations that change state
8. **Never log secrets or raw tokens**

## Edge Function Pattern

```typescript
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { guardAuth } from "../_shared/auth.ts";
import { createClient } from "../_shared/supabase.ts";
import { getCorrelationId } from "../_shared/correlation.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  // 1. Authenticate
  const auth = guardAuth(req);
  if (!auth.ok) return auth.response;

  // 2. Authorize (check roles for write operations)
  // 3. Validate request body
  // 4. Create client + call service
  const supabase = createClient(req);
  const correlationId = getCorrelationId(req);
  // ... service call → JSON response
});
```

## Key Types

- **EventEnvelope**: requires \`idempotencyKey\`, \`correlationId\`, has \`occurredAt\` (not \`createdAt\`)
- **ProvenanceEntry**: SHA-256 hash chain with \`payloadHash\`, \`previousHash\`
- **AssetRegistryEntry**: entity graph node with \`kind\`, \`refId\`, \`domain\`
- **EvidenceLink**: connects two assets with \`linkKind\`, \`confidence\`

## Required Checks (must pass before PR merge)

```bash
npm run check    # runs typecheck + test + lint:imports + lint:migrations
npm run typecheck
npm run test
npm run lint:imports    # scripts/check-banned-imports.sh
npm run lint:migrations # scripts/check-migrations.sh
```

CI also runs \`dependency-review\` on PRs — new dependencies with moderate+ vulnerabilities will block merge.

## PR Conventions

Every PR must include:
- List of changed files
- Which domain boundaries were respected
- What was intentionally deferred
- Confirmation that \`npm run check\` passes

## When Unsure

Stop and ask for scope approval if a change:
- Crosses domain boundaries
- Requires frontend code
- Modifies \`_shared/auth.ts\` or RLS policies
- Adds a new service-role write path
