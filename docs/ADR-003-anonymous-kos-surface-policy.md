# ADR-003: Anonymous public surfaces are gated by rate limit + origin allowlist, not KOS capability bundles

**Status:** Accepted
**Date:** 2026-04-24
**Deciders:** Nick Miller

## Context

Slices 2a (#167) and 2b (#174) wired `resolveEigenCapabilityAccess` / `enforceEigenKosCapabilityBundle` into the authenticated member-read surfaces (`eigen-retrieve`, `eigen-chat`, `eigen-widget-chat` eigenx-mode) and the authenticated operator-write surfaces (`eigen-ingest`, `eigen-fetch-ingest`). Two surfaces were explicitly deferred:

1. **`eigen-chat-public`** — anonymous chat endpoint rate-limited via `enforceEigenPublicRateLimit` (`public_rate_limit.ts`).
2. **`eigen-widget-chat` public mode** — HMAC-signed widget-session token issued to an origin-allowlisted site in `eigen_site_registry`.

Both answer the same question: what policy gates an **anonymous** caller to the `eigen_public` corpus?

The seeded `eigen_public` KOS rules (migration `202604240002`) all require `member` role:

| policy_tag     | capability_tag_pattern | effect | required_role |
| -------------- | ---------------------- | ------ | ------------- |
| `eigen_public` | `read:*`               | allow  | member        |
| `eigen_public` | `search`               | allow  | member        |
| `eigen_public` | `ai:*`                 | allow  | member        |
| `eigen_public` | `write:*`              | allow  | operator      |

Enforcing `enforceEigenKosCapabilityBundle` on the anonymous surfaces would return 403 for every request — there is no authenticated user and therefore no role to match. Options considered:

- **(A)** Add anon-compatible rules — `eigen_public` `read:*` / `search` / `ai:*` with `required_role=null`, meaning "any caller whose policy tag matches". Preserves the bundle enforcement on anon surfaces but widens the rule semantic to include "anonymous" as a first-class role.
- **(B)** Move anonymous surfaces to deny-by-default — drop them in favor of requiring auth for all KOS reads. Breaks current public widget + public chat product surfaces.
- **(C)** Keep the current gate (rate limit + origin allowlist + widget-token HMAC) as the **only** anonymous surface protection; don't layer KOS bundle enforcement on top.

## Decision

**Accept Option C.**

Anonymous public surfaces are gated by:

1. **`enforceEigenPublicRateLimit`** (`supabase/functions/_shared/public-rate-limit.ts`) — per-IP / per-origin rate budget written to `eigen_public_rate_buckets`.
2. **Origin allowlist** via `eigen_site_registry` — every anonymous widget session is issued against an explicitly-registered origin whose registry row carries `mode='public'` or `'mixed'` and `status='active'`.
3. **Widget-token HMAC** (for `eigen-widget-chat` public mode) — short-lived JWT signed with `EIGEN_WIDGET_SIGNING_SECRET`, bound to origin + site_id, verified every turn.
4. **Scope hardening** (migration `202604200001`) — defense-in-depth CHECK constraint preventing `eigen_site_registry` rows with `mode!='eigenx'` from carrying `default_policy_scope` containing `'eigenx'`, plus the client-side `assertNoClientPolicyScopeOverride` guard on the request parser.

KOS capability bundles are **not** enforced on the anonymous surfaces.

## Why not add anon allow rules?

Option A is tempting but introduces a new semantic: "this rule allows any caller regardless of role". The current `required_role` enum encodes the member/reviewer/operator/counsel/admin hierarchy — extending it with a null-means-anon interpretation conflates "no auth required" with "role doesn't matter for authenticated users". The policy engine's `hasRequiredRole` today correctly returns `true` for `requiredRole=null` against an empty `callerRoles` array, so Option A would work **mechanically** — but it means every future policy author has to remember that a `null required_role` rule is anon-accessible, not just role-unrestricted-authenticated.

The three gates in the current setup (rate limit, origin allowlist, widget HMAC) are already each purpose-built for anonymous traffic. Adding a fourth gate with overlapping intent doesn't tighten security — it adds a layer where the cost of misconfiguration (for example, a future operator editing `eigen_public` `read:*` to tighten to `member` without realizing anon public chat depended on `null`) is an outage, not a leak.

## Why not deny anonymous altogether?

Product surfaces that depend on anonymous `eigen_public` reads:

- **Ray's Retreat** public website (`raysretreat`) — anonymous visitors ask questions about the retreat; no login expected.
- **R2App** marketing / exploration surface — pre-signup users discover the product through the widget.
- **Operator-workbench** anonymous feed page — displays published Oracle theses / signals.

All three would break on Option B. The product requirement is unambiguous: anonymous reads of the `eigen_public` corpus are a first-class use case.

## Consequences

### Positive

- The four gates (rate limit, origin allowlist, widget HMAC, scope hardening) remain the single place to reason about anonymous surface protection.
- KOS rules stay true to their original design: role-based authorization for authenticated callers. No anon-conflation semantic.
- `enforceEigenKosCapabilityBundle`'s `rulesConfigured=false` short-circuit (which allows when no rules match) does **not** become a silent-allow hazard on anon surfaces — because we don't call it at all there.

### Negative / accepted risks

- An operator who assumes "KOS enforcement is layered everywhere" will read the anon chat code path and be surprised. Mitigated by:
  - Inline comments on each deferred surface (added in slice 2b / #174) explicitly calling out the rate-limit + origin gate.
  - This ADR as the canonical reference.
- Adding a new anonymous surface in the future requires the author to actively hook `enforceEigenPublicRateLimit` + pull the widget session / origin check; there's no single `requireAnonymousGate()` helper today. Follow-up to fold these into a shared `enforceAnonymousSurfaceGates(req, context)` helper is listed below.

## Follow-ups (out of scope for this ADR)

1. **Consolidation helper** — factor the rate-limit + origin-allowlist + widget-HMAC sequence in `eigen-chat-public` and `eigen-widget-chat` public-mode into one shared `enforceAnonymousSurfaceGates(...)` helper so adding a new anonymous surface can't accidentally skip a gate.
2. **Audit counter** — emit a structured log entry whenever an anonymous gate rejects a request (`anon_gate_reject` with `gate: 'rate_limit' | 'origin' | 'widget_token_expired' | 'widget_token_invalid'`) so operators can see denial rates in the same telemetry view as KOS bundle denials.
3. **Revisit if a genuinely role-unrestricted-but-authenticated rule appears** — Option A's semantic confusion is only a hazard if we conflate "no role needed" with "anon allowed". If a future use case needs the former, that's the trigger to introduce an explicit `anon` pseudo-role in `charter_role` rather than reusing `null`.

## References

- [PR #167](https://github.com/nickmiller-gif/R2/pull/167) — Slice 2a, member-read KOS enforcement on retrieve / chat / widget-chat-eigenx.
- [PR #174](https://github.com/nickmiller-gif/R2/pull/174) — Slice 2b, ingest KOS enforcement + explicit deferral of anon public chat (this decision).
- `supabase/functions/_shared/public-rate-limit.ts` — anonymous rate-limit helper.
- `supabase/functions/_shared/widget-session.ts` — widget-token HMAC issuance + verification.
- `supabase/functions/_shared/policy-scope-guard.ts` — client-override refusal.
- Migration `202604200001_eigen_site_registry_scope_hardening.sql` — CHECK constraint preventing scope drift.
- Migration `202604240002_eigen_public_kos_policy_rules.sql` — the `member`-required seed that motivates this ADR.
