# ADR-006: Operator Proposals — agentic draft layer above platform_feed_items

**Status:** Proposed
**Date:** 2026-05-05
**Deciders:** Nick Miller
**Supersedes:** none
**Amends:** none (relates to ADR-005 which governs ingest auth; this ADR governs a downstream consumer of the same sink)

## Context

Phase 1 shipped the R2 Signal Contract and the canonical sink
`public.platform_feed_items` (R2-Master-Brief.md § 8). Phase 6 shipped
`operator-workbench/src/pages/Today.tsx` as the operator's triage UI over that
sink. Together they implement the _signal flow_ of the ecosystem: producers
emit, the contract validates, normalize/resolve/score/publish happens, the
operator sees rows.

The next leverage step is not another producer or another viewer. It is the
inversion: the operator should not be the first reader of every signal. An
agent should read the stream, draft proposed actions when a pattern fires, and
present those drafts for approval — turning the operator's daily loop from
"triage and decide what to do" into "review and approve drafts."

This is the missing primitive. It is described in `R2 Master Brief` § 11
(stacked roadmap, 12-month horizon: "close the compounding loop where outcomes
retrain the system") but no concrete implementation exists in any repo.
Today.tsx is purely a viewer; oracle-operator generates whitespace runs but is
operator-initiated, not signal-driven; the existing Cloudflare Worker
(`cloudflare-agent-chatbot`) is a chat surface, not a portfolio agent.

## Decision

Add a new table `public.operator_proposals` and a new Cloudflare Worker
`r2-proposal-drafter`. The Worker reads `platform_feed_items` (cron-polled and
realtime), runs deterministic pattern modules over each new signal, and
inserts drafted proposals into `operator_proposals`. The operator reviews
proposals in `Today.tsx` (separate UI PR) using a new
`decide_operator_proposal(proposal_id, decision, reviewer_id, notes,
modified_actions)` RPC.

The proposal lifecycle is:

```
draft → queued → in_review → { approved | modified | rejected | expired }
approved/modified → executing → { executed | execution_failed }
```

Pattern modules in v1:

- `crossBrandActor` — fires when a single MEG actor produces signals from
  ≥2 distinct `source_system` values in a 30-day window.
- `whitespaceFollowup` — fires when new signals corroborate evidence on a
  previously-deferred Oracle whitespace run.

Future patterns (post-v1) follow the same `PatternModule` interface and slot
in additively.

## Rationale

- **Inverts the operator loop.** Today.tsx makes Nick the first reader. With a
  drafter, the agent is the first reader and Nick is the approver. This is the
  shift that makes a six-brand portfolio actually tractable.

- **Builds on existing primitives, doesn't replace them.** The drafter consumes
  `platform_feed_items` through normal RLS reads. The proposals table mirrors
  `platform_feed_items` conventions exactly (RLS policy shape, RPC SECURITY
  DEFINER + SET search_path + REVOKE/GRANT, GIN indexes on uuid arrays). No
  existing surface changes.

- **Pattern modules are deterministic.** Each pattern is a pure function over
  `(signal, context) → Proposal | null`. The optional LLM enrichment step
  only touches natural-language fields (`rationale`); it never invents
  `proposed_actions`, `evidence_*`, or `confidence`. This keeps the drafter
  auditable and red-teamable on the same axes as OWSR.

- **Reversal cost is first-class.** Every proposed action carries a
  `reversal_hint` and the proposal carries an `estimated_reversal_cost` enum
  (`trivial` … `irreversible`). The operator-facing UI surfaces this prominently
  so approval friction scales with consequence.

- **Cross-brand signal is a first-class scoring axis.** The `cross_brand_count`
  column and the `claim_operator_proposals_for_review` RPC's ORDER BY both
  prioritize multi-brand correlations. This is the structural answer to "how
  does the portfolio compound?" — the system continuously surfaces work that
  spans more than one brand surface, which is exactly the opportunity that's
  invisible to single-brand tools.

## Implementation

- Migration: `R2/supabase/migrations/202605051200_operator_proposals_v1.sql`.
- Worker: `r2-proposal-drafter/` (new sibling repo under `R2 Complete`).
- UI: separate PR against `operator-workbench` adds a `/today` proposals tray
  with Approve / Modify / Reject buttons that call `decide_operator_proposal`
  via Supabase RPC.
- Auth: drafter uses the R2 Eigen project's service-role key to read/insert.
  The `decide_operator_proposal` RPC is granted to `authenticated` so operators
  call it under their own JWT (RLS-checked through `charter_user_roles`).

## Comparison to alternatives considered

1. **Build the drafter inside `oracle-operator`.** Rejected. Oracle is the
   evidence-and-thesis engine; it should not also own the operator action
   layer. Keeping them separate means each can be deployed and rolled back
   independently, and it lets Oracle remain operator-initiated while the
   drafter is signal-initiated.

2. **Extend `cloudflare-agent-chatbot`.** Rejected. That worker is a chat
   surface with a different deploy cadence and a different audit posture.
   Bundling would conflate two products.

3. **Add a `proposal` column directly to `platform_feed_items`.** Rejected.
   One signal can spawn multiple proposals (the same actor showing up in three
   brands could fire `crossBrandActor`, `whitespaceFollowup`, and
   `charterObligation` simultaneously). Many-to-one needs a separate table.

4. **Skip the agentic layer; have operators write SQL views over
   `platform_feed_items`.** Rejected. The whole point is to remove operator
   reading-time from the loop. Views still require Nick to be the first reader.

## Risks

- **Draft spam.** A buggy pattern could generate hundreds of low-value drafts.
  Mitigations: (a) `MIN_CROSS_BRAND_FOR_QUEUE` env defaults to 2 so only
  multi-brand drafts auto-queue; single-brand drafts stay in `draft` for manual
  review; (b) `expires_at` is set on every draft (default 14 days); (c) the
  `expire_stale_operator_proposals()` sweeper is idempotent and crontab-able.

- **Auto-execute scope creep.** v1 stops at `approved`. Execution is a
  separate worker (`r2-proposal-executor`, future ADR) that the operator
  explicitly enables per `proposal_kind`. Until that ships, `approved` is a
  terminal state from the drafter's perspective.

- **MEG drift.** Pattern modules depend on `actor_meg_entity_id` accuracy. If
  MEG resolution is wrong, drafts are wrong. Mitigation: the proposal carries
  the `triggering_signal_ids` and the operator can always inspect the source
  signals before approving.

- **Service-role key blast radius.** The drafter holds the R2 service-role
  key. Mitigation: store as Worker secret; rotation cadence aligns with the
  90-day cycle ADR-005 § Operational notes mandates.

## Operational notes

- Apply the migration before deploying the Worker — the Worker will refuse to
  start if `select 1 from public.operator_proposals limit 0` fails.
- Wire the cron once `platform_feed_items` has ≥7 days of cross-brand traffic
  (i.e. after Stream A and Stream B′ from `R2-NEXT-ACTION.md` close). Until
  then, run cron disabled and exercise the path manually via `/admin/replay`.
- The companion UI PR against `operator-workbench` is gated on this ADR
  merging.

## Status changes

- ADR-001 audit log: record this decision in its next entry.
- `R2-Master-Brief.md` § 11 (12-month roadmap): add "Phase 7 — agentic draft
  layer" as a named item with this ADR as the entry point.
- `R2-NEXT-ACTION.md`: add a Stream F entry once the migration applies cleanly
  in staging.
