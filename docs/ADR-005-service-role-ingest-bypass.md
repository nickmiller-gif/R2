# ADR-005: Service-role auth bypass on r2-signal-ingest, gated by HMAC

**Status:** Accepted
**Date:** 2026-04-26
**Deciders:** Nick Miller
**Supersedes:** none
**Amends:** none (relates to ADR-002 edge-function-auth-jose-jwks; does not change its decision for any other endpoint)

## Context

Phase 1 of the ecosystem activation plan (`R2-Master-Brief.md` § 8, `R2-Ecosystem-Wire-Plan.md` §§ 1–4) established the R2 Signal Contract and a single canonical ingest function `r2-signal-ingest`. The function uses `guardAuth()` from `_shared/auth.ts`, which verifies Bearer tokens against the project's JWKS as user-issued auth tokens (per ADR-002).

The first server-to-server producer (centralr2) cannot satisfy that requirement. Centralr2 emits signals from server-side edge functions; it does not have a Supabase user session to mint a JWT from. The verification probe added to centralr2's AIHealthCheck UI surfaced this with `401 Invalid or expired token`.

Three options were considered:

1. **Provision a service user in R2** and mint a long-lived JWT for it. Centralr2 stores that JWT and refreshes via the refresh-token loop. No code change to R2.
2. **Add a service-role bypass on `r2-signal-ingest`**, gated by a valid HMAC body signature. Code change to R2; no changes to consumers' refresh logic.
3. **Replace `guardAuth` with a static pre-shared-secret check.** Simplest, least secure — the r2app audit already flagged this exact pattern (S1: `upload-retreat-content` validating only Bearer presence) as a high-severity finding.

Option 3 is rejected. Options 1 and 2 are both defensible. This ADR records the decision to take Option 2 for `r2-signal-ingest` specifically.

## Decision

Add a narrow service-role bypass on the `r2-signal-ingest` function only.

When all three conditions hold:

1. The Bearer token in the request's Authorization header equals this project's `SUPABASE_SERVICE_ROLE_KEY` (timing-safe compare), and
2. `R2_SIGNAL_INGEST_HMAC_SECRET` is configured on this project, and
3. The request body's `x-r2-signature` HMAC verifies against that secret,

then the request is accepted without invoking `guardAuth`. When any of those conditions is false, the previous user-JWT path is preserved.

The change is intentionally local to this function. Other edge functions continue to use `guardAuth` as the sole authentication path.

## Rationale

- **HMAC is the real auth.** Service-role keys are static and live in server-side secret stores. They do not prove a request originated from any specific producer. The HMAC body signature does — a producer without `R2_SIGNAL_INGEST_HMAC_SECRET` cannot forge a valid signature even if they have the service-role key (which they should not). The service-role bearer becomes a coarse presence gate; the HMAC carries the cryptographic burden.

- **Fail-closed defaults.** If `R2_SIGNAL_INGEST_HMAC_SECRET` is not configured on this project, the bypass refuses to engage and returns 401. A misconfigured deploy cannot accidentally accept service-role-only requests with no HMAC verification.

- **Scope contained.** Only `r2-signal-ingest` accepts this path. Other functions continue to require user-issued JWTs. The service-role key cannot be used to bypass auth on any other surface in this project.

- **Auditable.** Every successful ingest logs `auth_mode = 'service_role' | 'user_jwt'` so the audit trail tells you which path each request took.

- **Reversible.** The bypass adds a single conditional. Reverting requires deleting `tryServiceRoleAuth` and the `serviceRole?.mode` branch in the handler — roughly 25 LOC.

## Comparison to ADR-002

ADR-002 mandated `guardAuth` for every edge function as the response to the prior "any non-empty bearer is accepted" pattern. That decision stands for every endpoint _except_ this one. The exception is justified because:

- This endpoint is the keystone of the ecosystem signal pipeline; it must accept server-to-server traffic from many producer projects, none of which have user sessions.
- The HMAC layer provides a stronger origin proof than user-JWT auth would for a service-to-service flow (a producer's user JWT could be stolen and replayed; the HMAC requires the body signature to also match).

If a future endpoint needs the same pattern, the implementation should be lifted into `_shared/auth.ts` as a named helper (`guardAuthOrServiceRole`) so the policy is centralized. Until then, the inline implementation in `r2-signal-ingest/index.ts` keeps the surface area small and visible.

## Operational notes

- The `SUPABASE_SERVICE_ROLE_KEY` env var that this function reads is the **R2 project's own** service-role key (auto-injected by Supabase). Producers will need to obtain that same key from R2's dashboard and store it in their own secret stores under `R2_SIGNAL_INGEST_BEARER`.
- Producers must also be configured with the same `R2_SIGNAL_INGEST_HMAC_SECRET` value as the R2 project, or signature verification will fail.
- 90-day rotation cadence: when R2's service-role key rotates, every producer's `R2_SIGNAL_INGEST_BEARER` must be updated in lockstep. Automate this in CI/secrets-rotation tooling before scaling to more producers (per the ecosystem activation checklist § C5).
- A regression in this auth path is a **policy-scope incident** under the rollout-gate definition in the ADR-001 audit log, requiring immediate manual rollback.

## Status changes

- ADR-001 audit log should record this decision in its next entry.
- The Phase-1 status doc references this ADR as the resolution to the centralr2 probe failure.
