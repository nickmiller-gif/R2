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
}

// Service
interface EntityService {
  createEntity(input: Omit<Entity, 'id' | 'createdAt'>): Promise<Entity>;
  getEntityById(id: string): Promise<Entity | null>;
  listEntities(filter?: EntityFilter): Promise<Entity[]>;
}

// Factory
function createEntityService(db: EntityDb): EntityService { /* impl */ }
```

## Hard Rules

1. **No frontend code** — ever, in any PR
2. **One bounded slice per PR** — do not cross domain boundaries
3. **Additive migrations only** — never DROP or ALTER destructively
4. **snake_case in DB rows, camelCase in domain entities**
5. **Run `npm run check` before claiming completion** (lint, typecheck, test, build)
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

## Edge Function Pattern

```typescript
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();
  const supabase = createClient(req);
  // thin handler: auth check → service call → JSON response
});
```

## Key Types

- **EventEnvelope**: requires `idempotencyKey`, `correlationId`, has `occurredAt` (not `createdAt`)
- **ProvenanceEntry**: SHA-256 hash chain with `payloadHash`, `previousHash`
- **AssetRegistryEntry**: entity graph node with `kind`, `refId`, `domain`
- **EvidenceLink**: connects two assets with `linkKind`, `confidence`

## Validation

```bash
npm run check    # lint + typecheck + test + build
npm run typecheck
npm run test
```

## PR Conventions

Every PR must include:
- List of changed files
- Which domain boundaries were respected
- What was intentionally deferred
- Confirmation that `npm run check` passes
