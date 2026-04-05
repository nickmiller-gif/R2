# ADR-002: Edge Function Auth via Offline JWT Verification (jose + JWKS)

**Status:** Accepted
**Date:** 2026-04-05
**Deciders:** Nick Miller

## Context

R2 is a headless Supabase backend serving multiple Lovable-built frontends across separate domains (SmartPLRx, CentralR2, R2 Charter, R2 Control, and future product surfaces). All frontends authenticate against a single Supabase project (`zudslxucibosjwefojtm`).

R2 currently has 24 edge functions. Every one of them calls `guardAuth(req)` from `_shared/auth.ts`, which only verifies that a Bearer token is **present** in the Authorization header. It does not validate the token's signature, expiration, issuer, or claims. Any string in the Authorization header is accepted.

Additionally:
- All 24 functions use `getServiceClient()` (service-role key) for write operations, bypassing RLS entirely.
- Zero functions check user roles or permissions beyond token presence.
- Zero functions enforce idempotency keys on mutations.
- The `charter_user_roles` table and `role.service.ts` exist but are unused at the edge layer.

This creates an unauthorized escalation pathway: any request with any Authorization header value can write to any table through any edge function.

### Forces

1. **Multiple frontends, one backend.** All Lovable apps share the same Supabase Auth, producing JWTs signed by the same project keys. The auth solution must handle tokens from any frontend without per-app configuration.

2. **Performance at scale.** With N frontends each calling M edge functions, auth verification runs on every request. A network round-trip per verification multiplies latency across the surface area.

3. **Supabase is moving away from implicit JWT verification.** The `verify_jwt` flag is being deprecated. Supabase now recommends user-owned auth code using their JWT Signing Keys and JWKS endpoint.

4. **Asymmetric JWT signing.** Supabase has replaced the legacy symmetric JWT secret with asymmetric signing keys. The jose/JWKS pattern is the only approach that supports key rotation natively.

5. **RBAC foundation exists.** `charter_user_roles` defines five roles (`member`, `reviewer`, `operator`, `counsel`, `admin`) with a service layer ready to query. The auth upgrade should make this queryable at the edge.

## Options Considered

### Option A: `supabase.auth.getClaims(token)`

The simplest approach. Pass the bearer token to the Supabase client, receive decoded claims or an error.

- **Pro:** Minimal code. Always validates against the latest auth state.
- **Con:** One network call per request to Supabase Auth. With multiple frontends hitting 24 edge functions, this adds latency at scale. Newer Supabase pattern, less battle-tested.

### Option B: Offline JWT verification with `jose` + JWKS

Use `jose.createRemoteJWKSet()` pointing at the project's `/.well-known/jwks.json` endpoint, then `jose.jwtVerify()` for each request. JWKS is fetched once and cached; subsequent verifications are pure in-memory cryptographic operations.

- **Pro:** Zero network overhead after initial JWKS fetch. Supabase's officially recommended template pattern. Supports asymmetric key rotation natively. Works identically for all frontends since they share the same JWKS.
- **Con:** More code to write and maintain. Must handle JWKS cache refresh on key rotation (jose handles this automatically).

### Option C: `supabase.auth.getUser(token)`

Legacy approach. Makes a network call to validate the token and returns the full user object.

- **Pro:** Returns complete user profile.
- **Con:** Slowest option (full user fetch per request). Supabase is actively moving away from this pattern. Unnecessary data fetched when only claims are needed.

## Decision

**Option B: Offline JWT verification with jose + JWKS.**

## Rationale

1. **Performance.** Every request across every frontend is verified with zero network calls (after JWKS cache warm-up). This is critical when N Lovable frontends each produce traffic against 24 edge functions.

2. **Official recommendation.** This is the pattern Supabase provides as their canonical edge function auth template, using `jsr:@panva/jose@6`.

3. **Key rotation support.** The JWKS approach automatically handles Supabase's asymmetric signing key rotation. `jose.createRemoteJWKSet()` re-fetches keys when it encounters an unknown `kid`.

4. **Frontend-agnostic.** All Lovable frontends authenticate against the same Supabase project and produce JWTs signed by the same keys. One JWKS endpoint, one verifier, every frontend covered.

5. **Clean upgrade path.** The current `guardAuth()` returns `{ ok: true, token }`. The upgrade changes this to `{ ok: true, claims: { userId, ... } }` — same discriminated union pattern, richer payload. All 24 edge functions update with minimal diff.

6. **Enables RBAC.** The verified `sub` claim (user ID) feeds directly into `charter_user_roles` lookups, enabling per-endpoint role checks without caring which frontend originated the request.

## Implementation Plan

### Phase B-1: Shared Auth Module
- Replace `_shared/auth.ts` with jose-based JWT verification
- Extract `userId` and `claims` from verified token
- Add `requireRole()` helper that checks `charter_user_roles` for the verified user
- Add dependency-free request body validation helper in `_shared/validate.ts`
- Write tests for the shared auth module

### Phase B-2: Roll Out to Edge Functions
- Update all 24 edge functions to use the new `guardAuth()` signature
- Add role checks to write endpoints (POST/PATCH/DELETE)
- Enforce `x-idempotency-key` header on mutations
- Standardize error responses across all functions

### Phase B-3: RLS Policy Audit
- Audit all tables for service-role-only write policies
- Document RBAC contracts for tables staying service-role
- Write granular RLS policies for tables migrating to user-writes
- Add indexes on policy-relevant columns

## Consequences

- **Positive:** Eliminates the unauthorized escalation pathway. Adds real identity verification. Enables fine-grained RBAC. Zero-latency auth for multi-frontend architecture.
- **Negative:** More code to own in `_shared/auth.ts`. Must ensure JWKS cache behaves correctly under Deno edge runtime. Must coordinate key rotation awareness across environments.
- **Neutral:** `getServiceClient()` remains in use for writes, but is now gated behind verified identity + role checks rather than bare token presence.

## References

- [Supabase: Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Supabase: JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys)
- [jose library (JSR)](https://jsr.io/@panva/jose)
- [Supabase custom JWT validation template](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/custom-jwt-validation)
- ADR-001: R2 as Headless Backend with Pluggable Frontend Domains
