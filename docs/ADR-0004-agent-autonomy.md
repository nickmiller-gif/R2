# ADR-0004 · Agent autonomy (Series E)

| Field  | Value        |
| ------ | ------------ |
| Status | **Proposed** |
| Date   | 2026-05-08   |

## Context

Autonomous Ops surfaces (`autonomous-bot-os-in`, `cloudflare-agent-chatbot`, `oracle-operator`, `operator-workbench`) need to run actions without a human click while respecting the **Oracle publication boundary** (Master Brief § 8 Stage 6), **MEG** resolution expectations, and **policy_scope** constraints on Eigen/EigenX retrieval.

Related decisions:

- **ADR-0001** — Audit log and retention expectations for operator-visible actions.
- **ADR-0003** — `r2-signal-ingest` auth: service-role + HMAC over body, user JWT path with `guardAuth`, mandatory `x-idempotency-key` for dedupe.

## Decision

### 1. Server-pinned capability registry

Every autonomous write path MUST check a **server-side** capability grant before executing:

- Grants are stored in Postgres (e.g. `bot_os.capability_grants`) and asserted via RPC such as `bot_os.assert_capability(agent_id, action, policy_scope)` returning boolean.
- Clients and browser agents **cannot widen** `policy_scope`; the server compares the requested scope against `allowed_policy_scope` on the grant row.
- Expired or revoked grants MUST fail closed (`false`).

### 2. Signal emit obligation

Every autonomous action that mutates state or completes a bounded task MUST emit a **signal-contract v1** envelope to `r2-signal-ingest` when `ENABLE_R2_SIGNAL_INGEST` is true, with:

- `routing_targets` including **`operator_workbench`** so `/today` and operator triage surfaces receive the row.
- `privacy_level` aligned to the effective retrieval scope (`public` only when the action is explicitly public-safe; otherwise `operator` or `private` per product policy).
- Deterministic **`x-idempotency-key`** (and thus `source_signal_key`) per `(capability_id, target_id, attempt)` or equivalent so retries dedupe.

### 3. Publication-boundary actions

Actions that move content toward **`eigen_public`** visibility (promotion, publish, charter mirrors) MUST retain **two-eyes** or equivalent governance already encoded in Whitespace / Oracle pipeline UIs until explicitly superseded by a future ADR. Autonomous loops MUST NOT bypass those gates.

### 4. Cross-repo consumption

| Clause                 | Primary consumers                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| §1 Capability registry | `autonomous-bot-os-in`, `cloudflare-agent-chatbot` (via RPC or shared DB), bot driver workers |
| §2 Signal emit         | All Series E producers calling `r2-signal-ingest`                                             |
| §3 Publication         | `oracle-operator`, `operator-workbench`                                                       |

## Consequences

- New migrations and Edge/Worker secrets for ingest (R2 Eigen service role + HMAC) per ADR-0003; cite operational pitfalls **A1–A3** in PRs.
- Operator workload shifts from “guess what ran” to **feed-backed** observability; failed emits should surface as deadletters with replay where supported.

## Status

**Proposed** — merge after review; promote to **Accepted** when capability registry is deployed and at least one producer emits under this ADR.
