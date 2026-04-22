# ADR-002 follow-up: service-role write surface (audit note)

This document satisfies the **Phase B-3** intent to make explicit which data paths still use the **Supabase service role** after JWT verification and `charter_user_roles` checks at the edge.

## Why service role remains

R2 edge functions verify the caller with `guardAuth()` (offline JWKS) and gate mutations with `requireRole()` where implemented. Most mutations still execute inserts/updates through **`createSupabaseClientFactory().service()`** (or legacy `getServiceClient()`), which bypasses row-level security (RLS). That is intentional for slices where:

- Tables are locked to **service_role** for writes under RLS (Charter governance kernel pattern), or
- Operator workflows need **consistent** writes regardless of JWT RLS drift, or
- Legacy tables have not yet been migrated to user-scoped writes.

## Tables commonly written via service client (non-exhaustive)

| Area | Tables (examples) | Notes |
|------|-------------------|--------|
| Charter | `charter_governance_entities`, `charter_governance_transitions`, `charter_entities`, … | RLS typically restricts writes to `service_role`; edge uses service client after RBAC. |
| Oracle | `oracle_signals`, `oracle_theses`, `oracle_evidence_items`, publication audit | Operator scope; publication workflow uses service client. |
| MEG | `meg_entities`, `meg_entity_aliases`, `meg_entity_edges` | Service writes after operator role check. |
| Eigen | `tool_capabilities`, `eigen_policy_rules`, `knowledge_chunks`, retrieval/memory, ingest | Mixed read paths (`user(req)`) vs operator writes (`service()`). |
| Foundation | `foundation` domain tables | Same pattern as Charter slices. |

## Authenticated read paths

Several functions use **`supabaseClients.user(req)`** or `getSupabaseClient(req)` for GETs so **RLS** applies to listing and detail reads (e.g. published Oracle scope, Charter lists).

## Policy for future changes

1. Prefer **additive** RLS and indexes when introducing user-scoped writes; avoid broad policy rewrites in one PR.
2. When migrating a table from service-only writes to user writes, update **both** the migration and the edge function in the same slice, and extend tests.
3. Keep this file updated when a table’s write path changes materially.

## Related

- `docs/ADR-002-edge-function-auth-jose-jwks.md`
- `supabase/functions/_shared/supabase.ts` — `createSupabaseClientFactory()`
