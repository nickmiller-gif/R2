# @r2/eval — Op#5 offline AI eval harness

Scaffold for **operational bet #5** in the whitespace audit: an offline harness
(prompt corpus, Vitest runners, scorers, optional CLI) that gates
credibility-critical synthesis behind sustained pass-rate trends.

## Layout (target)

- `prompts/` — YAML corpus (hard prompts across domains)
- `runners/` — Vitest + `runDeterministicHarness` (expand to HTTP chatbot runners)
- `scorers/` — `scoreKeywordConstraints` (substring allow/deny) + future LLM-judge
- `cli/` — future `r2-eval run` entrypoint

## References

- Umbrella: `R2-Whitespace-Audit-2026-05-08.md` (eval harness / 85% threshold)
- Features: `R2-Revolutionary-Features-2026-05-09.md` section 6
- Next actions: `R2-NEXT-ACTION.md` (Op#5 parallel track)

## Status

`0.0.2` — corpus includes **keyword constraints** on adversarial prompts; **`scoreKeywordConstraints`**, **`runDeterministicHarness`**, Vitest **`runner-deterministic`**. GitHub Actions **`.github/workflows/r2-eval-harness.yml`** runs `tests/r2-eval/` on a weekly cron + path filters.
