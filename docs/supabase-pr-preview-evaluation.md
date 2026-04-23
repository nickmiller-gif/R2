# Supabase PR Preview DB Evaluation

## Goal

Evaluate whether R2 should provision per-PR preview databases using Supabase branching.

## Current State

- CI validates code quality and tests on pull requests via `.github/workflows/ci.yml`.
- Linked remote checks (`lint:supabase:drift`, `lint:supabase:types`) are intentionally gated off on PRs because schema changes are not yet pushed to production.
- Deploys run only from `main` via `.github/workflows/deploy.yml`.

## Findings

### Benefits

- Preview branches catch migration/runtime drift before merge.
- PR reviewers can test schema-dependent edge-function behavior in an isolated DB.
- Generated types can be validated against branch schema instead of mainline schema.

### Costs / Risks

- Higher CI duration and Supabase branch lifecycle overhead.
- Requires secure handling for branch database credentials in ephemeral CI jobs.
- Needs cleanup guarantees to avoid orphaned preview branches.

## Recommendation

Adopt a phased rollout:

1. **Phase 1 (manual preview)**  
   Add a `workflow_dispatch` workflow that creates a Supabase preview branch for a PR number and runs:
   - `supabase db push`
   - `npm run lint:supabase:types`
   - selected smoke tests

2. **Phase 2 (automatic on PR label)**  
   Trigger branch creation only when PR is labeled `preview-db` to control cost.

3. **Phase 3 (automatic for schema-touching PRs)**  
   Trigger when `supabase/migrations/**` changes and tear down the preview branch on PR close.

## Suggested Implementation Notes

- Keep production `deploy.yml` unchanged.
- Use least-privilege tokens scoped to preview operations.
- Write branch metadata (branch id, db url, cleanup status) into the PR summary.
- Add cleanup workflow on `pull_request.closed` to drop preview branches.

## Exit Criteria

- At least 5 migration PRs validated against preview DB without manual intervention.
- No orphan preview branches after PR close.
- CI runtime increase stays within agreed budget.
