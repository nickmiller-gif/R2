-- M10 ingest observability: stale-runs watchdog + warnings_count column
--
-- 1) works.legislation_ingest_stale_runs(threshold interval) — returns
--    runs that are still pending/running past the threshold. This is
--    the signal PR-A's invoke-error fixes can't fully replace: even
--    with the error-mark guard in place, an edge fn that DID claim the
--    run but then crashed mid-flight (Deno runtime OOM, downstream
--    Anthropic timeout, etc.) leaves the row in 'running' indefinitely.
--    Operators (and a future cron) read this to find them.
--
-- 2) warnings_count — surface adapter warning volume directly on the
--    run row. Today the warnings array is buried in the run's summary
--    markdown (legislation_run_outputs.content_markdown), which means
--    the run-history list can't show a "3 warnings" badge without
--    reading the summary blob. The edge fn already builds the array
--    at completion time; this column just lets it persist the count.

-- 1) Stale runs watchdog
create or replace function works.legislation_ingest_stale_runs(
  threshold interval default interval '15 minutes'
)
returns table (
  id uuid,
  status text,
  source_system text,
  jurisdiction text,
  operator_user_id uuid,
  created_at timestamptz,
  started_at timestamptz,
  stuck_for interval
)
language sql
stable
set search_path = works, public
as $$
  select
    r.id,
    r.status,
    r.source_system,
    r.jurisdiction,
    r.operator_user_id,
    r.created_at,
    r.started_at,
    -- For running: how long since started_at. For pending: how long
    -- since created_at. Each gives the actionable "stuck how long?".
    case
      when r.status = 'running' and r.started_at is not null
        then now() - r.started_at
      else now() - r.created_at
    end as stuck_for
  from works.legislation_ingest_runs r
  where r.status in ('pending', 'running')
    and (
      (r.status = 'pending' and r.created_at < now() - threshold)
      or (r.status = 'running' and coalesce(r.started_at, r.created_at) < now() - threshold)
    )
  order by r.created_at asc;
$$;

grant execute on function works.legislation_ingest_stale_runs(interval) to authenticated, service_role;

comment on function works.legislation_ingest_stale_runs(interval) is
  'Operator watchdog: returns ingest runs older than the threshold still pending/running. Pre-PR-A failure mode left rows in pending forever when the edge fn invoke failed; this gives ops visibility into either that case (pre-PR-A rows) or the post-PR-A residual case (edge fn claimed the row but crashed mid-flight).';

-- 2) Warnings count column
alter table works.legislation_ingest_runs
  add column if not exists warnings_count integer not null default 0;

comment on column works.legislation_ingest_runs.warnings_count is
  'Total adapter + extraction warnings emitted during the run. Populated by legislation-ingest when status transitions to done/error. The full warning strings remain in the run summary markdown (works.legislation_run_outputs section=summary); this column is for surfacing badges in the run-history list without reading the summary blob.';;
