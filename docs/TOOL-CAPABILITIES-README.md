# Tool Capabilities System — README for AI Agents

> **Read this first** before adding, modifying, or querying tool capabilities in R2.
>
> This document is the canonical reference for how the capability catalog, policy engine,
> and RBAC interact. It explains the dual-view design and the rules for evolving it.

---

## TL;DR

R2 has a **policy-aware tool manifest** that governs what every edge function and action can do, who can invoke it, and whether approval is required. It has three moving parts:

1. **`tool_capabilities`** — the catalog (what tools exist, their risk, their approval posture)
2. **`eigen_policy_rules`** — pattern-matched allow/deny rules evaluated at runtime
3. **`charter_user_roles`** — RBAC mapping users to roles (`member → reviewer → operator → counsel → admin`)

At request time, the policy engine checks: *given this user's roles + this policy scope, are they allowed to invoke a tool with these capability tags?*

---

## The Dual-View Catalog

The `tool_capabilities` table contains **two coexisting views** of the same underlying edge-function surface. **This is intentional.**

| View | Convention | Granularity | Count | Seeded By | Purpose |
|------|-----------|-------------|-------|-----------|---------|
| **`edge.*`** (canonical) | `edge.<function>.<mode>` | Per edge function × (read/write) | 64 | `202604130002` + `202604140001_add_multi_llm` | Policy enforcement — what the engine gates on |
| **Action-level** (supplement) | `<subsystem>-<resource>-<verb>` | Per distinct action within a function | 111 | `202604170001` | Fine-grained audit, UI, and approval differentiation |

### Why two views?

A single edge function can perform **several semantically different actions** with very different risk profiles. The coarse `edge.*` view groups them under one `tool_id`; the action-level view breaks them out.

**Example:** the `charter-payouts` edge function handles both creating drafts and approving payouts. One is medium-risk; one is **money movement**.

| tool_id | Risk | Approval | Role |
|---------|------|----------|------|
| `edge.charter-payouts.write` (coarse) | high | user_approval | operator |
| `charter-payouts-create` (action) | high | **user_approval** | operator |
| `charter-payouts-update` (action) | high | **user_approval** | operator |
| `charter-payouts-approve` (action) | high | **admin_approval** 🛡️ | operator |

The policy engine uses `edge.*` for request-time enforcement. UIs, approval workflows, and audit trails use action-level for precision.

### Which one should I use?

| Situation | Use |
|-----------|-----|
| Writing a policy rule (`eigen_policy_rules`) | `edge.*` pattern (e.g., `read:*`, `write:*`, or tag-based) |
| Rendering a permissions UI | Action-level |
| Writing an audit log entry | Action-level (more specific) |
| Adding a new edge function | Add **both** — an `edge.*` row AND the action-level rows |
| Querying "what can this user do?" | Action-level (better UX) |

---

## Schema

```sql
CREATE TABLE tool_capabilities (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id                TEXT NOT NULL UNIQUE,          -- e.g. 'charter-payouts-approve'
  name                   TEXT NOT NULL,                  -- human-readable
  capability_tags        JSONB NOT NULL DEFAULT '[]',    -- ['write:payout', 'admin:approval']
  io_schema_ref          TEXT,                           -- optional schema pointer
  mode                   tool_mode NOT NULL,             -- 'read' | 'write'
  approval_policy        approval_policy NOT NULL,       -- 'none_required' | 'user_approval' | 'admin_approval'
  role_requirements      JSONB NOT NULL DEFAULT '[]',    -- ['operator']
  connector_dependencies JSONB NOT NULL DEFAULT '[]',    -- ['supabase', 'openai']
  blast_radius           TEXT,                           -- 'low' | 'medium' | 'high'
  fallback_mode          TEXT,                           -- graceful degradation behavior
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Capability tag conventions

- **Domain prefix**: `eigen`, `charter`, `oracle`, `meg`, `foundation`
- **Mode wildcard**: `read:*`, `write:*` (auto-added by `202604130003_align_capability_tags_and_policy_rules.sql`)
- **Resource + verb**: `write:payout`, `read:knowledge`, `admin:publication`
- **Scope**: `public`, `widget`, `ai:synthesis`
- **Special**: `admin:role`, `admin:lifecycle`, `admin:approval` — escalation markers

---

## Policy Rule Evaluation

`eigen_policy_rules` gates access by matching **capability tags** against **policy scope** and **caller roles**.

```sql
CREATE TABLE eigen_policy_rules (
  policy_tag              TEXT NOT NULL,   -- 'eigenx', 'eigen_public', 'eigenx:user:<id>'
  capability_tag_pattern  TEXT NOT NULL,   -- wildcard: 'read:*', 'write:payout', '*'
  effect                  TEXT NOT NULL,   -- 'allow' | 'deny'
  required_role           charter_role,    -- NULL = any role (including anonymous)
  rationale               TEXT,
  metadata                JSONB
);
```

### Evaluation order (deny-first)

1. Load all rules matching the user's **policy scope** (org + user-scoped grants from `eigen_policy_access_grants`)
2. Check **deny** rules first — any match → denied
3. Check **allow** rules — must match at least one, and user must have required role
4. If no allow rule matches → denied (default-deny)

### Baseline rules (seeded by `202604130003`)

| Policy | Pattern | Effect | Role |
|--------|---------|--------|------|
| `eigenx` | `read:*` | allow | `member` |
| `eigenx:*` | `read:*` | allow | `member` |
| `eigenx` | `write:*` | allow | `operator` |
| `eigenx:*` | `write:*` | allow | `operator` |

---

## How to Add a New Capability

When you add a new edge function or action, **follow this checklist**:

1. **Create the edge function** in `supabase/functions/<name>/index.ts`
2. **Add the service layer** in `src/services/<subsystem>/` following the existing pattern
3. **Write types** in `src/types/<subsystem>/` — `interface FooService`, `interface FooDb`, `DbFooRow`, `rowToFoo`
4. **Create an additive migration** (`202604XXXXXX_<name>.sql`):
   - Append `edge.<name>.<mode>` row(s) to `tool_capabilities`
   - Append action-level rows if the function has >1 distinct action
   - Use `ON CONFLICT (tool_id) DO UPDATE` for idempotency
   - **Never `DELETE` from `tool_capabilities`** — additive only (per project convention)
5. **Add policy rules** if the default `read:*` / `write:*` gates aren't sufficient
6. **Update this README** if the convention changes
7. **Push to remote** with `supabase db push --linked`

### Migration template

```sql
-- Add capabilities for <feature>. Additive upsert.
INSERT INTO public.tool_capabilities (
  tool_id, name, capability_tags, mode, approval_policy,
  role_requirements, connector_dependencies, blast_radius, fallback_mode
) VALUES
  ('edge.my-function.write', 'My function write', '["my-subsystem","write:*"]'::jsonb,
   'write'::tool_mode, 'user_approval'::approval_policy,
   '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'deny')
ON CONFLICT (tool_id) DO UPDATE SET
  name = EXCLUDED.name,
  capability_tags = EXCLUDED.capability_tags,
  mode = EXCLUDED.mode,
  approval_policy = EXCLUDED.approval_policy,
  role_requirements = EXCLUDED.role_requirements,
  connector_dependencies = EXCLUDED.connector_dependencies,
  blast_radius = EXCLUDED.blast_radius,
  fallback_mode = EXCLUDED.fallback_mode,
  updated_at = now();
```

---

## Deployment

### Local (Supabase CLI)

```bash
cd /path/to/R2
supabase db reset          # re-applies all migrations from scratch
# OR
supabase db push --local   # applies pending migrations to running local
```

Verify:
```bash
docker exec -i supabase_db_R2 psql -U postgres -d postgres \
  -c "SELECT COUNT(*) FROM tool_capabilities;"
# Expected: 175 (64 edge.* + 111 action-level)
```

### Remote (production Supabase)

Project ref: `zudslxucibosjwefojtm`

```bash
cd /path/to/R2
supabase db push --linked
```

Or via the MCP Supabase connector:
```
mcp__e47e967c__apply_migration
```

---

## Where This Is Enforced

| Layer | Location | What it checks |
|-------|----------|----------------|
| **Edge function entry** | `supabase/functions/_shared/rbac.ts` → `requireRole()` | User has required charter_role |
| **Policy evaluation** | `supabase/functions/_shared/eigen-policy-engine.ts` | Capability tags pass policy rules |
| **Scope resolution** | `supabase/functions/_shared/eigen-policy-access.ts` | User's effective policy scope |
| **Service layer** | `src/services/eigen/policy-engine.service.ts` | Runtime rule evaluation |
| **Capability registry** | `src/services/eigen/tool-capability.service.ts` | Read/write catalog |

## Cloudflare Integration

Cloudflare Workers (e.g., `cloudflare-agent-chatbot`) call R2 edge functions via HTTPS and do **not** access the `tool_capabilities` table directly. They inherit policy enforcement from the edge functions they call. If you add a worker that needs to invoke a capability on a user's behalf, forward the user's JWT so the edge function can resolve their policy scope.

No Cloudflare config needs to change when tool capabilities are updated — enforcement happens server-side in Supabase.

---

## Related Documentation

| Doc | Purpose |
|-----|---------|
| [`tool-capabilities-catalog.md`](./tool-capabilities-catalog.md) | Full `edge.*` canonical listing |
| [`tool-capability-matrix.md`](./tool-capability-matrix.md) | Human-readable action-level matrix with risk/approval breakdown |
| `ADR-002-edge-function-auth-jose-jwks.md` | Auth pattern (JWT verification) |
| `RLS-AUDIT-PHASE-B.md` | Row-level security audit |
| `r2-capability-rollout-smoke.md` | Smoke test procedure |

## Related Migrations

| Migration | Purpose |
|-----------|---------|
| `202604020026_charter_user_roles.sql` | Defines `charter_role` enum + RBAC table |
| `202604020042_eigen_tool_capabilities.sql` | Creates `tool_capabilities` table |
| `202604080009_eigen_policy_access_grants.sql` | Per-user/per-role policy scope grants |
| `202604090003_eigen_policy_engine_rules.sql` | Creates `eigen_policy_rules` registry |
| `202604130001_eigen_policy_rules_seed_baseline.sql` | Baseline allow rules |
| `202604130002_seed_tool_capabilities_catalog.sql` | Seeds the 61 canonical `edge.*` entries |
| `202604130003_align_capability_tags_and_policy_rules.sql` | Adds `read:*`/`write:*` tags + retires wildcard allows |
| `202604140001_add_multi_llm_tool_capabilities.sql` | Extends catalog with 3 LLM-router entries |
| `202604170001_action_level_capabilities_supplement.sql` | Adds 111 action-level rows (supplement) |

---

## Rules for AI Agents Editing This System

1. **Additive only.** Never `DELETE` from `tool_capabilities` or `eigen_policy_rules` in a migration. If a tool is retired, mark it and leave the row.
2. **Idempotent seeds.** Always use `ON CONFLICT (tool_id) DO UPDATE` or `WHERE NOT EXISTS`.
3. **Timestamp migration filenames** in order (`YYYYMMDDHHMM_` prefix). Check for collisions with `ls supabase/migrations/`.
4. **Follow Charter Slice 01 patterns** — service factories, `DbRow` types, `rowToEntity` mappers.
5. **Minimum blast radius.** Small, reviewable, reversible slices.
6. **Define contract first** — schema + types + service interface — then implement.
7. **Both views** — when adding an edge function, seed both an `edge.*` row AND any action-level rows.
8. **Never hardcode role strings** — use the `charter_role` enum values.
9. **Test** — add coverage in `tests/eigen/tool-capability.service.test.ts` or equivalent.
