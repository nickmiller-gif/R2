# CODEX Slice Protocol for R2

**Status:** Active  
**Date:** 2026-04-03  
**Authority:** ADR-001

---

## Purpose

This protocol governs how Copilot (and any other automated agent) operates in the R2 repository. R2 is a **headless backend only**. Every change must fit inside one bounded slice. Agents must refuse scope creep and stop when boundaries are violated.

---

## Core Rules

### 1. One Slice Per PR

Each pull request implements exactly one bounded slice. A slice is a single, coherent unit of backend work (e.g., a new service interface, a migration, a domain type set, an edge function group). Multiple slices must never be bundled into one PR.

### 2. No Frontend Code

R2 contains no frontend code. This means:

- No React, Vue, Svelte, or any other UI framework
- No components, pages, routes, or layouts
- No `apps/` additions
- No Vite, Next.js, or Remix configs
- No CSS, Tailwind, or style sheets
- No `NEXT_PUBLIC_*` or `VITE_*` environment variable references

If a change requires frontend logic, it belongs in a Lovable frontend repo — not here.

### 3. No Unrelated Domain Files

A slice declared for `charter/` must not touch `oracle/`, `eigen/`, or `foundation/` unless the slice explicitly declares a cross-domain dependency and it is approved in the issue. The converse applies to every other domain.

### 4. No Unrelated Migrations

Migrations must be scoped to the declared domain. A `charter` slice must not include Oracle or Eigen table changes. Migration filenames must follow the pattern:

```
YYYYMMDD_<domain>_<description>.sql
```

### 5. Preserve the R2 Service Pattern

Every service must follow this exact structure:

```typescript
// types/
export type DbXxxRow = { ... };        // raw DB row shape
export type XxxEntity = { ... };       // domain object

// services/
export interface XxxDb {               // port: what the service needs from DB
  findById(id: string): Promise<DbXxxRow | null>;
  // ...
}

export interface XxxService {          // contract: what callers consume
  getById(id: string): Promise<XxxEntity | null>;
  // ...
}

export function rowToEntity(row: DbXxxRow): XxxEntity { ... }

export function createXxxService(db: XxxDb): XxxService {
  return {
    async getById(id) {
      const row = await db.findById(id);
      return row ? rowToEntity(row) : null;
    },
    // ...
  };
}
```

Deviations from this pattern require explicit justification in the PR.

### 6. Update Tests

When a slice changes public behavior (adds a function, changes a type signature, adds a service method), tests must be added or updated. Tests live in `tests/` and follow the existing fixture + Vitest pattern.

### 7. Update Barrel Exports

When a slice adds a new public type or service, the relevant `index.ts` barrel export must be updated. Forgetting barrel exports breaks downstream consumers.

### 8. Run `npm run check` Before Claiming Completion

`npm run check` runs `tsc --noEmit && vitest run`. A slice is not done until this passes clean. The agent must not open a PR if `npm run check` fails.

---

## Cross-Domain Access Rules

Following ADR-001:

| Consumer | Can Read | Cannot Directly Access |
|----------|----------|----------------------|
| Oracle   | Charter governance state (via service interface) | Charter tables directly |
| Eigen    | Oracle intelligence, Charter governance (via service interfaces) | Oracle/Charter tables directly |
| Charter  | Nothing from Oracle or Eigen | — |

All cross-domain access **must go through service interfaces**. Direct table reads across domain boundaries are forbidden.

---

## Stop Conditions

An agent must stop immediately and report the violation (without making changes) if:

1. The declared slice would require frontend code
2. The declared slice touches tables/services outside the declared domain
3. A migration includes tables from an unrelated domain
4. Tests would require imports from outside the slice boundary
5. `npm run check` fails and the failure cannot be fixed within the slice scope
6. The implementation would require widening the scope beyond what the issue declares

When a stop condition is triggered, the agent must:

1. State which stop condition was hit
2. Describe what would be required to proceed
3. Ask for explicit scope approval before continuing

---

## PR Requirements

Every PR must include in its description:

- **Issue implemented:** `#<number> — <title>`
- **Files changed:** full list of added/modified files
- **Boundaries respected:** confirmation of each rule above
- **Intentionally deferred:** anything in scope that was not implemented, and why

---

## Sequence of Slices

See `docs/ADR-001-headless-backend-pluggable-frontends.md` for the full phased extraction plan (Phases 0–5, Slices 01–20). Work proceeds in numbered order. Only the first unblocked slice in the sequence is implemented per PR.

---

## Enforcement

This protocol is enforced by:

1. `docs/copilot/IMPLEMENT_SLICE_PROMPT.md` — agent instructions for implementation
2. `docs/copilot/CRITIQUE_SLICE_PROMPT.md` — agent instructions for post-implementation critique
3. PR review (human or automated) against this document

Any PR that violates these rules must be rejected until the violation is corrected.
