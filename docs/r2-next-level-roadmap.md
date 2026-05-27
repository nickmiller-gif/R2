# R2 Next-Level Roadmap (Oracle / MEG / Eigen)

**Status:** proposal for review. Each slice below is sized to a single PR
following the minimum-blast-radius protocol from `plan.md`. Order is
recommended, not locked. Pick / reorder / drop slices freely.

## Frame

The catch-up sprint left R2 with a strong floor: full per-surface policy
audit, hardened MEG external bridge, parallel fan-outs, eslint/test gates,
unblocked Supabase Preview. "Next level" means moving from
governance/correctness to **measurable capability uplift** — better answers,
faster learning loops, less manual curation.

The three concrete uplifts that compound on each other:

1. **Eigen retrieval quality** — cross-encoder rerank + multi-query fusion.
2. **Oracle learning loop** — evidence + outcomes recalibrate thesis
   confidence automatically.
3. **MEG identity precision** — fuzzy disambiguation proposal queue so
   external data stops fragmenting the canonical graph.

Beyond those, the **cross-domain bridges** (MEG-aware retrieval boost,
Oracle-signal → Eigen-memory) are where the platform stops being three
adjacent systems and starts being one product.

---

## Eigen slices

### E1 — Cross-encoder reranking on `eigen-retrieve` ★

**Problem.** Embedding similarity is high-recall, mid-precision. Current
ranking is `cosine + oracle whitespace boost`. Top-1 / top-3 quality on
chat is the bottleneck.

**Slice.** Add a stage-2 reranker: top-K=20 vector hits → cross-encoder
scores → top-N=5 returned. Pluggable port + default Voyage/Cohere
implementation. Off by default; opt-in per scope or per request.

**Files.**

- `src/services/eigen/reranking.service.ts` (new)
- `src/types/eigen/reranking.ts` (new)
- `supabase/functions/_shared/eigen-reranker.ts` (new)
- `supabase/functions/eigen-retrieve/index.ts` (wire-up)
- `tests/eigen/eigen-reranking.service.test.ts` (new)

**Tests.** Stub reranker, assert top-N reordering preserves the cross-encoder
order; assert latency budget (default 400ms, fail-open on timeout); assert
opt-out path is identical to current behavior.

**Risk.** External API dependency (reranker provider). Mitigation:
fail-open — if reranker errors or times out, return the original
embedding ranking. Cost monitored via existing eigen audit metadata.

**No migrations.**

---

### E2 — Multi-query RAG fusion ★

**Problem.** User questions are often ambiguous ("how does retrieval
work?" hits 50 chunks weakly; the right chunks would surface with a more
specific phrasing).

**Slice.** Cheap LLM call expands user query into 2–3 reformulations;
retrieval runs against each; reciprocal-rank-fusion unions the results.

**Files.**

- `src/services/eigen/query-expansion.service.ts` (new)
- `src/lib/eigen/reciprocal-rank-fusion.ts` (new, pure)
- `supabase/functions/eigen-retrieve/index.ts` (wire-up)
- `tests/eigen/reciprocal-rank-fusion.test.ts` (new)
- `tests/eigen/query-expansion.service.test.ts` (new)

**Tests.** RRF math; expansion shape contract; opt-out parity.

**Risk.** Latency stack-up with E1. Mitigation: parallelize the
per-expansion retrievals (`Promise.all`). Cap at 3 expansions.

**Pairs naturally with E1** but is independently shippable.

---

### E3 — Memory consolidation episodes

**Problem.** `memory_entries` is flat. Long-running operator chats
accumulate noise; chat context bloat degrades answer quality.

**Slice.** Cron-driven job that clusters recent memories by entity +
topic and writes compact `memory_episodes` summaries; chat retrieval
prefers episodes when available, falls back to raw entries.

**Files.**

- New migration: `memory_episodes` table + indexes.
- `src/services/eigen/memory-episode.service.ts`
- `supabase/functions/eigen-memory-episodes` (new)
- Cron in `supabase/config.toml`

**Tests.** Clustering determinism, summary shape, retrieval-prefers-episode.

**Risk.** Detail loss if summarization is too aggressive — keep raw
`memory_entries` rows for N days alongside episodes; reversible.

---

### E4 — Persistent citation IDs

**Problem.** Chat cites source chunks but the citation IDs are
session-scoped. Operator audit can correlate `eigen_policy_decisions`
to chat turns but not to the specific chunks shown to the user.

**Slice.** New `eigen_chat_citations` table; chat surfaces issue
canonical citation IDs that link `(chat_turn_id, chunk_id,
policy_decision_id)`.

**Files.**

- New migration: `eigen_chat_citations`.
- `src/services/eigen/citation.service.ts`
- `supabase/functions/eigen-chat/index.ts` + widget-chat wire-up.

**Tests.** Citation persistence; lookup by chat turn; FK integrity.

**Risk.** Low. Additive.

---

## Oracle slices

### O1 — Thesis confidence reweighting (closing the loop) ★

**Problem.** Oracle theses are scored at creation but don't learn
from new evidence or recorded outcomes. The
`oracle_thesis_evidence_links` table grows; thesis `confidence` stays
frozen.

**Slice.** Add `recalibrate_thesis_confidence(thesis_id, reason)` RPC.
Trigger on:

- New evidence linked → Bayesian update (simple, transparent).
- Outcome recorded → multiplier based on whether the thesis's prediction
  matched the outcome.

Audit trail in `oracle_thesis_confidence_history`.

**Files.**

- New migration: `oracle_thesis_confidence_history` + RPC.
- `src/services/oracle/oracle-thesis-confidence.service.ts`
- `supabase/functions/oracle-ws-pipeline/index.ts` (call after evidence
  ingest)
- `src/services/oracle/oracle-outcome.service.ts` (call after outcome)

**Tests.** Bayesian update math; outcome multiplier; history table grows
on every recalibration; idempotency.

**Risk.** Defining the weight formula. Start simple (Bayesian with prior
= existing confidence, likelihood from evidence confidence) and version
the formula via `recalibration_method` column so we can A/B later.

---

### O2 — Contradiction surface

**Problem.** When two `oracle_evidence_items` linked to the same thesis
point opposite directions at high confidence, that contradiction is
invisible to operators.

**Slice.** Pure view `oracle_thesis_contradictions` over existing tables;
new endpoint surfaces them per thesis. No new tables.

**Files.**

- New migration: view + grants.
- `supabase/functions/oracle-read-models/index.ts` (extend).
- `src/services/oracle/oracle-read-model.service.ts` (extend).

**Tests.** View math against fixture; endpoint shape.

**Risk.** Low. Read-only view.

---

### O3 — Outcome attribution / predictive accuracy

**Problem.** Once an outcome (won / lost) is recorded, we don't
automatically back-fill which signals + theses correctly anticipated it.
No way to score Oracle's predictive accuracy over time.

**Slice.** New `oracle_signal_outcome_attribution` table. When an
outcome is recorded, attribute it to signals that fired in the temporal
window preceding it on related entities. Generates `prediction_correct`
booleans the next iteration can use to weight signal confidence.

**Files.**

- New migration.
- `src/services/oracle/oracle-attribution.service.ts`
- `src/services/oracle/oracle-outcome.service.ts` (extend).

**Tests.** Window logic; multiple-signal attribution; idempotency on
re-run.

**Risk.** Temporal reasoning correctness. Mitigation: configurable
attribution window, default 30 days, recorded on each attribution row.

---

### O4 — Truth Market opportunity auto-draft

**Problem.** When whitespace + thesis cross promotion thresholds, an
operator manually creates the `oracle_opportunities` row. High-confidence
signals get lost in the gap.

**Slice.** Threshold-driven trigger: when `oracle_ws_pipeline` lands a
thesis with confidence ≥ T1 AND whitespace score ≥ T2, auto-create a
**draft** opportunity with the thesis's evidence pre-attached. Operator
review still required to promote draft → active.

**Files.**

- `supabase/functions/oracle-ws-pipeline/index.ts` (wire-up)
- `src/services/oracle/oracle-opportunity-promotion.service.ts` (new)
- New migration: thresholds in `oracle_opportunity_promotion_config`
  (defaults seeded).

**Tests.** Threshold math; idempotency on re-run; drafts respect existing
RLS.

**Risk.** Low — drafts are reversible, operator still gates promotion.

---

## MEG slices

### M1 — Embedding-based fuzzy identity proposal queue ★

**Problem.** `meg_resolve_or_create` is exact-match only on
`(source_platform, external_id)` + email. External data fragments the
canonical graph: "John Smith" vs "John A. Smith" vs "smith@x.com".

**Slice.** When exact match fails, embed the canonical name + any hints,
do nearest-neighbor search over existing `meg_entities` embeddings, and
when similarity > T write to `meg_resolve_proposals` for operator review.
Caller still gets the new entity created (no behavior break); proposal
is the second-class audit signal.

**Files.**

- New migration: `meg_resolve_proposals` + `meg_entities.canonical_embedding`
  column (lazy backfill).
- `src/services/meg/meg-resolve-proposal.service.ts`
- `supabase/functions/meg-resolve-bridge/index.ts` (extend; same for
  internal RPC path).

**Tests.** Similarity threshold; proposal idempotency; false-positive
guards (require email match OR > 2 confirming aliases before high-sev).

**Risk.** Cost of embedding generation. Mitigation: only embed on the
fallback path, not the happy path.

---

### M2 — Edge strength scoring

**Problem.** `meg_entity_edges` has `edge_type` but no `confidence` or
`evidence_count`. Two edges of the same type with one supporting signal
look identical to two edges with 50 confirming signals.

**Slice.** Additive `confidence` column on `meg_entity_edges`,
incremented on confirming signal upserts, decayed by a scheduled job.
Read models surface the value.

**Files.**

- New migration: add column, backfill default `0.5`, scheduled decay job.
- `src/services/meg/meg-entity-edge.service.ts` (extend).

**Tests.** Confirmation increments; decay math; backfill correctness.

**Risk.** Low. Additive column.

---

### M3 — Cross-domain entity bridge proposal

**Problem.** Charter, Oracle, and Eigen all reference entities. When the
same human / org appears under different aliases across the three
domains, the canonical bridge is currently manual.

**Slice.** Scheduled job inspects co-occurrence (same email, same
canonical*name, alias overlap) across `charter_entities`, `oracle*\*`entity references, and`meg_entities`. Writes `meg_bridge_proposals` for
operator review.

**Files.**

- New migration: `meg_bridge_proposals`.
- `src/services/meg/meg-bridge-proposal.service.ts`
- New edge function: `meg-bridge-proposals` (read + accept).

**Tests.** Co-occurrence detection; dedup against existing bridges.

**Risk.** Medium — depends on M1's embedding infra to be useful.

---

## Cross-domain bridges

### X1 — MEG-aware Eigen retrieval boost

**Problem.** Retrieval doesn't currently use MEG graph structure. A
chunk mentioning "Acme Corp" doesn't benefit from a query about Acme's
parent company.

**Slice.** When retrieval matches mention a known `meg_entity_id`, boost
chunks that share `entity_ids` with the matched entity's MEG graph
neighbors (1-hop). Configurable boost weight.

**Files.**

- `src/lib/eigen/chat-retrieval-context.ts` (extend).
- `src/services/eigen/retrieval-meg-boost.service.ts` (new).
- `tests/eigen/retrieval-meg-boost.test.ts` (new).

**Tests.** Boost math; no-neighbor case; opt-out parity.

**Risk.** Low. Additive ranking signal.

---

### X2 — Oracle signal → Eigen memory bridge

**Problem.** When Oracle records a high-confidence signal about an
entity ("Acme just announced layoffs"), operator chats about Acme don't
surface that signal as recent memory.

**Slice.** Background job that promotes high-confidence Oracle signals
into Eigen `memory_entries` scoped to the relevant operator + entity.

**Files.**

- `supabase/functions/eigen-oracle-outbox-drain/index.ts` (extend —
  already exists for outbox draining).
- `src/services/eigen/oracle-signal-promotion.service.ts` (new).

**Tests.** Promotion threshold; dedup against existing memory entries;
RLS preservation.

**Risk.** Medium — cross-domain side effects. Opt-in flag per operator
during rollout.

---

## Recommended sequencing

The path with the strongest compounding effect:

1. **E1** — reranking. Immediate chat-answer quality jump. Two days.
2. **O1** — thesis reweighting. Closes Oracle's prediction-feedback
   loop. Sets up O3 and X2.
3. **M1** — MEG fuzzy proposals. Sets up X1, M3.
4. **E2** — multi-query fusion. Pairs with E1; deeper recall.
5. **O2** — contradiction view. Fast read-model win.
6. **X1** — MEG-aware boost. Now that M1 is mature, retrieval can lean
   on the graph.
7. **O3, O4, E3, E4, M2, M3, X2** — second wave once 1–6 are stable.

Each slice is an independently mergeable PR. No slice depends on a later
slice except as listed.

## Out of scope (call out before someone asks)

- **Frontend.** All UI lives in operator-workbench / Lovable repos.
- **Public-facing model swaps.** This roadmap assumes the current
  embedding + chat models stay; reranking is the only new model class.
- **raysretreat extraction.** The archived legacy repo is closed.
  Anything we still want from it gets re-implemented here, not ported.
- **EigenX-KOS deeper enforcement.** The plan.md backlog for that closed
  this sprint; no new EigenX slices proposed unless an operator gap
  surfaces.

## Question for you before I start

Which subset do you want me to take? Pick a number, pick a domain, pick
the recommended order, or rewrite the list. I'll start as soon as you
point.
