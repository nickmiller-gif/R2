# ADR-0003 · R2 Signal Ingest — Edge function JWT verification

| Field   | Value                                                                                                                                                                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status  | Accepted                                                                                                                                                                                                                                                                                            |
| Date    | 2026-04-30                                                                                                                                                                                                                                                                                          |
| Related | [`ADR-0003-signal-contract.md`](./ADR-0003-signal-contract.md) (short name), [`supabase/functions/r2-signal-ingest`](../supabase/functions/r2-signal-ingest), [`supabase/config.toml`](../supabase/config.toml), [`ADR-005-service-role-ingest-bypass.md`](./ADR-005-service-role-ingest-bypass.md) |

This ADR is the **canonical copy inside the `R2` repository**. The same decision text is mirrored under the umbrella workspace path `docs/adr/ADR-0003-r2-signal-ingest-edge-auth.md` when this repo is nested in **R2 Complete**; treat this file as the source of truth for R2-only checkouts and PRs.

## Context

Phase 1 originally specified `verify_jwt = true` on `r2-signal-ingest`. The shipped implementation uses `verify_jwt = false` and **`guardAuth`** inside the function so the R2 edge stack stays consistent with other Foundation functions that perform custom bearer + optional HMAC validation.

## Decision

Keep **`verify_jwt = false`** for `r2-signal-ingest` and rely on **`guardAuth`** (service bearer, optional `x-r2-signature` HMAC, and idempotency headers) as the security boundary.

## Consequences

- Producers must never expose `R2_SIGNAL_INGEST_BEARER` or `R2_SIGNAL_INGEST_HMAC_SECRET` to browser bundles; they remain edge-only secrets on producer projects (`r2app`, `centralr2-core`, `oracle-operator`, etc.).
- Rotations require coordinated updates on both ingest and producer sides (see producer runbooks under each repo’s `docs/runbooks/`).
- Future hardening may add IP allowlists or mTLS; any move to `verify_jwt = true` must be evaluated against service-to-service JWT issuance for non-user callers.
