# RLS Policy Audit — Phase B

**Date:** 2026-04-05
**Auditor:** Claude (Opus) + Nick Miller
**Scope:** All 27 public tables in Supabase project `zudslxucibosjwefojtm`

---

## Executive Summary

All 27 tables have RLS enabled. The codebase uses a **dual-layer security model**:

1. **Edge Function RBAC** (application layer): `guardAuth()` verifies JWT offline via jose+JWKS, then `requireRole()` gates mutations to `operator`+ (or `admin` for charter-roles). Idempotency keys required on all writes.
2. **Postgres RLS** (database layer): Policies enforce row-level access. GETs use the caller's JWT token (`getSupabaseClient(req)`), so RLS filters reads. Mutations use `getServiceClient()` (service_role), so RLS is bypassed — the edge RBAC is the gatekeeper.

This is an intentional architecture: edge functions are the only write path, and service_role bypasses RLS by design so that RBAC-authorized operators can write any row. RLS serves as **defense-in-depth for reads** and a **safety net** if a service_role token were ever leaked.

---

## Access Pattern Classification

### Pattern A — Service-Role-Only Writes (10 tables)

Write policy: `service_role` → `ALL` with `qual: true`.
Read policy: `authenticated` → `SELECT` with `qual: true` (global read).

| Table | Read Scope | Notes |
|-------|-----------|-------|
| `asset_registry` | All authenticated | Global catalog |
| `asset_evidence_links` | All authenticated | Join table |
| `charter_decisions` | All authenticated | Governance records |
| `charter_entities` | All authenticated | Governance entities |
| `charter_evidence` | All authenticated | Supporting evidence |
| `charter_governance_entities` | All authenticated | Governance structure |
| `charter_governance_transitions` | All authenticated | State transitions |
| `charter_rights` | All authenticated | Rights definitions |
| `oracle_signals` | All authenticated | Market signals |
| `tool_capabilities` | All authenticated | EigenX tool registry |

**Verdict: ✅ Correct.** These are system/governance tables. Any authenticated user may read them; only RBAC-authorized operators (via edge functions + service_role) may write. No changes needed.

### Pattern B — Service-Role Writes, Owner-Scoped Reads (4 tables)

Write policy: `service_role` → `ALL`.
Read policy: `authenticated` with ownership filter.

| Table | Read Filter | Notes |
|-------|------------|-------|
| `charter_obligations` | `created_by = auth.uid()` | Users see only their own obligations |
| `charter_payouts` | `created_by = auth.uid()` | Users see only their own payouts |
| `charter_user_roles` | `user_id = auth.uid()` | Users see only their own role assignments |
| `documents` | `owner_id = auth.uid()` | Users see only their own documents |

**Verdict: ✅ Correct.** Owner-scoped reads prevent cross-tenant data leakage. Service-role writes gated by edge RBAC. No changes needed.

### Pattern C — Hybrid Writes (service_role OR owner) (9 tables)

Write policies grant access to both `service_role` AND the owning user (`profile_id = auth.uid()` or parent-join ownership check).

| Table | Ownership Check | Read Scope | Roles Granted To |
|-------|----------------|-----------|-----------------|
| `meg_entities` | `profile_id = auth.uid()` | All authenticated | `{public}` |
| `meg_entity_aliases` | Parent join → `meg_entities.profile_id` | All authenticated | `{public}` |
| `meg_entity_edges` | Parent join → source `meg_entities.profile_id` | All authenticated | `{public}` |
| `oracle_evidence_items` | `profile_id = auth.uid()` | Owner only | `{authenticated,service_role}` |
| `oracle_outcomes` | `profile_id = auth.uid()` | All authenticated | `{public}` |
| `oracle_source_packs` | `profile_id = auth.uid()` | Owner only | `{authenticated,service_role}` |
| `oracle_theses` | `profile_id = auth.uid()` | Owner OR published | `{authenticated,service_role}` |
| `oracle_thesis_evidence_links` | Parent join → `oracle_theses.profile_id` | Owner OR published thesis | `{authenticated,service_role}` |
| `oracle_thesis_knowledge_links` | Parent join → `oracle_theses.profile_id` | All authenticated | `{public}` |

**Verdict: ⚠️ Functional but has issues — see Findings below.**

### Pattern D — Pure Owner CRUD (2 tables)

Full CRUD granted to `authenticated` users, scoped by ownership.

| Table | Ownership Check | Notes |
|-------|----------------|-------|
| `knowledge_chunks` | Parent join → `documents.owner_id = auth.uid()` | Per-command policies (SELECT, INSERT, UPDATE, DELETE) |
| `memory_entries` | `owner_id = auth.uid()` | Per-command policies |

**Verdict: ✅ Correct.** User-owned data with proper ownership enforcement on all four operations.

### Pattern E — Special Cases (2 tables)

| Table | Pattern | Notes |
|-------|---------|-------|
| `charter_provenance_events` | Read-only (`authenticated` SELECT, no write policy) | Append-only audit log. Writes only via service_role (no explicit write policy needed — RLS denies by default). ✅ |
| `retrieval_runs` | Service-role everything (SELECT, INSERT, UPDATE all `service_role` only) | Internal system table. Not accessible to authenticated users at all. ✅ |

---

## Findings

### Finding 1: `{public}` role grants on MEG and Oracle tables (Medium Risk)

**Tables affected:** `meg_entities`, `meg_entity_aliases`, `meg_entity_edges`, `oracle_outcomes`, `oracle_thesis_knowledge_links`

**Issue:** Write policies are granted to `{public}` role instead of `{authenticated}` or `{authenticated,service_role}`. In Supabase, the `public` role is the anon key role. This means an unauthenticated request using only the anon key could theoretically write to these tables if it satisfies the ownership check (`profile_id = auth.uid()`).

**Actual risk:** Low in practice because `auth.uid()` returns NULL for anon requests, so the ownership check fails. But granting to `{public}` is a hygiene issue — it's unnecessarily permissive and could become a vulnerability if a future policy uses `qual: true`.

**Recommendation:** Tighten write policy roles from `{public}` to `{authenticated,service_role}` on all 5 tables. This is a zero-downtime, additive change.

### Finding 2: Edge functions bypass RLS on writes by design (Informational)

All 24 edge functions use `getServiceClient()` for mutations, which means RLS write policies are never evaluated for edge-initiated writes. The hybrid write policies (Pattern C) exist for direct Supabase client access from frontends — but the R2 architecture routes all writes through edge functions.

**Implication:** The RLS write policies on Pattern C tables are a second line of defense. If a Lovable frontend ever makes a direct write (not through an edge function), RLS would enforce ownership. This is correct defense-in-depth.

**Recommendation:** No change needed. Document this as an architectural invariant.

### Finding 3: No DELETE policy on Pattern A tables (Low Risk)

Pattern A tables use `cmd: ALL` for service_role, which covers DELETE. But there's no explicit authenticated DELETE policy, which means authenticated users cannot delete — this is correct, as deletes should go through edge functions.

**Verdict:** ✅ Correct by design.

### Finding 4: `oracle_theses` has publication-aware read policy (Informational)

The SELECT policy is: `profile_id = auth.uid() OR publication_state = 'published'`. This is a well-designed visibility model — users see their own drafts plus any published theses.

`oracle_thesis_evidence_links` mirrors this with a parent join. `oracle_evidence_items` and `oracle_source_packs` are owner-only reads, which makes sense as raw evidence is private.

**Verdict:** ✅ Well-designed. No changes needed.

---

## Index Coverage

All foreign key columns referenced in RLS policy `qual` expressions have indexes:

| Column | Tables With Index |
|--------|------------------|
| `profile_id` | `meg_entities`, `oracle_evidence_items`, `oracle_outcomes`, `oracle_source_packs`, `oracle_theses` |
| `owner_id` | `documents`, `memory_entries` |
| `user_id` | `charter_user_roles` (+ unique constraint) |
| `created_by` | `charter_decisions`, `charter_entities`, `charter_evidence`, `charter_obligations`, `charter_payouts`, `charter_rights` |
| `document_id` | `knowledge_chunks` |
| `meg_entity_id` | `meg_entity_aliases` |
| `source_entity_id` | `meg_entity_edges` (2 indexes) |
| `target_entity_id` | `meg_entity_edges` |
| `thesis_id` | `oracle_outcomes`, `oracle_thesis_evidence_links` (+ PK), `oracle_thesis_knowledge_links` (+ unique constraint) |
| `entity_asset_id` | `oracle_signals` |

**Verdict:** ✅ No missing indexes. All RLS subquery join columns are indexed.

---

## Action Items

| # | Action | Priority | Effort |
|---|--------|----------|--------|
| 1 | Tighten `{public}` → `{authenticated,service_role}` on 5 MEG/Oracle write policies | Medium | 1 migration |
| 2 | Add admin seed migration for bootstrap lockout (from earlier finding) | Medium | 1 migration |
| 3 | Document dual-layer security model in ADR or CLAUDE.md | Low | Docs only |

---

## Conclusion

The RLS posture is solid. All 27 tables have RLS enabled, all ownership-check columns are indexed, and the dual-layer security model (edge RBAC + RLS) provides proper defense-in-depth. The one actionable finding is the `{public}` role hygiene issue on 5 tables, which should be tightened to `{authenticated,service_role}` in a single migration.
