# Critique Slice Prompt

Use this prompt when instructing Copilot to critique a completed slice PR against ADR-001 and the R2 contract-test architecture.

---

## Prompt Template

```
You are working in the nickmiller-gif/R2 repository.

Critique the current PR against docs/CODEX_SLICE_PROTOCOL.md and the R2 contract-test architecture.

Check for each of the following:

1. Scope creep
   - Does the diff touch files outside the declared slice domain?
   - Does it modify types, services, or migrations in an unrelated domain?
   - Does it include cleanup or refactoring not required by the issue?

2. Frontend leakage
   - Does the diff contain any React, Vue, or other UI framework code?
   - Does it reference VITE_*, NEXT_PUBLIC_*, or any frontend environment variable?
   - Does it add anything under apps/ or any component/page/route directory?

3. Unrelated files
   - Are there files in the diff that are not listed in the declared file scope?
   - Are there config, workflow, or package changes not required by the slice?

4. Unrelated migrations
   - Do any migration files in the diff include tables, views, or RLS policies from a domain other than the declared slice domain?
   - Do migration filenames follow YYYYMMDD_<domain>_<description>.sql?

5. Service pattern violations
   - Does every new or modified service have: XxxDb interface, XxxService interface, createXxxService(db) factory, DbXxxRow type, rowToEntity() mapper?
   - Does the service return domain objects (not raw DB rows)?
   - Are there any direct DB queries outside the Db interface implementation?

6. Missing tests
   - Does every new public function, service method, or type change have a corresponding test in tests/?
   - Do the tests use the existing Vitest + fixture pattern?
   - Do the tests cover the primary success path and at least one error/edge case?

7. Missing barrel exports
   - Are all new public types exported from the relevant index.ts?
   - Are all new service factories exported from the relevant index.ts?

8. Cross-domain access violations
   - Does any service or function import directly from another domain's internal modules?
   - Does any cross-domain dependency go through a service interface (required) rather than a direct table read (forbidden)?
   - Does Charter import anything from Oracle or Eigen (forbidden per ADR-001)?

Return your findings in this exact format:

---
## Hard Blockers
List any finding that must be fixed before merge. If none, write "None."

## Soft Improvements
List suggestions that improve quality but are not blocking. If none, write "None."

## Files to Fix
List each file that needs a change and briefly state why. If none, write "None."

## Bounded?
State whether this PR is truly bounded to the declared slice.
Answer: YES or NO, followed by one sentence of justification.
---
```

---

## Usage Notes

- Run this critique after the implementation agent has opened a PR but before merging.
- Hard blockers must be resolved. The agent must re-run `npm run check` after any fix.
- Soft improvements are at the reviewer's discretion.
- If the verdict is NO (not bounded), the PR must not be merged until all hard blockers are resolved and the critique returns YES.
