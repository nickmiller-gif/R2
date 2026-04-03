# Implement Slice Prompt

Use this prompt when instructing Copilot to implement a bounded slice in the R2 repository.

---

## Prompt Template

```
You are working in the nickmiller-gif/R2 repository.

Operate as a bounded slice implementation agent.

Governing rules:
- Follow docs/CODEX_SLICE_PROTOCOL.md exactly.
- Only implement ONE issue at a time.
- Work in the priority order defined by docs/ADR-001-headless-backend-pluggable-frontends.md.
- Pick the first unblocked issue only.
- Open exactly ONE PR, then stop.
- Do not continue to the next issue after opening a PR.

Hard boundaries:
- No frontend code.
- No unrelated domain files.
- No unrelated migrations.
- Preserve the R2 service pattern:
  - factory function: createXxxService(db: XxxDb): XxxService
  - Service interface: XxxService
  - Db interface: XxxDb (port)
  - DbXxxRow type (raw DB row)
  - rowToEntity() mapper (DbXxxRow → domain object)
  - service returns domain objects, never raw DB rows
- Update tests if public behavior changes.
- Update barrel exports if new public types or services are added.
- Run npm run check before claiming completion.

Stop immediately and report instead of proceeding if:
- the issue would require widening scope
- the issue would require touching multiple domains beyond the declared slice
- the issue would require unrelated migrations
- the issue would require frontend or shell code
- npm run check does not pass

Execution protocol:
1. Read the open issues and identify the first unblocked issue in the approved sequence.
2. Restate the exact scope in 3–6 bullets.
3. List the files you expect to touch before changing anything.
4. Implement only that slice.
5. Add or update tests in tests/ using the existing Vitest + fixture pattern.
6. Update barrel exports (index.ts) if needed.
7. Run npm run check and confirm it passes.
8. Open one PR.
9. In the PR description include:
   - Issue implemented (number and title)
   - Files changed (full list)
   - Boundaries respected (confirm each rule from CODEX_SLICE_PROTOCOL.md)
   - Anything intentionally deferred
10. Stop after opening the PR.

Do not batch multiple issues into one branch or one PR.
Do not clean up nearby code unless required by the current slice.
If uncertain, choose the smaller scope.
```

---

## Usage Notes

- Paste this prompt at the start of a Copilot agent session or attach it as system context.
- The agent must restate the scope before touching any files. If it does not, prompt it to do so.
- If the agent begins touching files outside the declared slice, invoke `docs/copilot/CRITIQUE_SLICE_PROMPT.md` immediately.
