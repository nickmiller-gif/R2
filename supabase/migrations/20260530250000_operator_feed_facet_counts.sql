-- Server-side facet counts for operator /today chips — accurate totals across
-- the full platform_feed_items table, honoring synthetic + content-first filters.

begin;

create or replace function public.operator_feed_facet_counts(
  p_include_synthetic boolean default false,
  p_exclude_event_types text[] default '{}'::text[]
)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  with base as (
    select
      processing_status,
      autonomy_decision
    from public.platform_feed_items
    where (
        p_include_synthetic
        or not public.platform_feed_item_is_synthetic(
          source_event_type,
          summary,
          provenance
        )
      )
      and (
        cardinality(p_exclude_event_types) = 0
        or source_event_type <> all(p_exclude_event_types)
      )
  ),
  status_counts as (
    select
      count(*)::int as all_count,
      count(*) filter (where processing_status = 'pending')::int as pending,
      count(*) filter (where processing_status = 'claimed')::int as claimed,
      count(*) filter (where processing_status = 'published')::int as published,
      count(*) filter (where processing_status = 'failed')::int as failed,
      count(*) filter (where processing_status = 'deadletter')::int as deadletter
    from base
  ),
  autonomy_counts as (
    select
      count(*)::int as all_count,
      count(*) filter (where autonomy_decision = 'auto_publish')::int as auto_publish,
      count(*) filter (where autonomy_decision = 'needs_review')::int as needs_review,
      count(*) filter (where autonomy_decision = 'blocked')::int as blocked,
      count(*) filter (
        where autonomy_decision is null
          or autonomy_decision not in ('auto_publish', 'needs_review', 'blocked')
      )::int as none
    from base
  )
  select jsonb_build_object(
    'status', jsonb_build_object(
      'all', s.all_count,
      'pending', s.pending,
      'claimed', s.claimed,
      'published', s.published,
      'failed', s.failed,
      'deadletter', s.deadletter
    ),
    'autonomy', jsonb_build_object(
      'all', a.all_count,
      'auto_publish', a.auto_publish,
      'needs_review', a.needs_review,
      'blocked', a.blocked,
      'none', a.none
    ),
    'total', s.all_count
  )
  from status_counts s, autonomy_counts a;
$$;

comment on function public.operator_feed_facet_counts(boolean, text[]) is
  'Facet badge counts for operator /today — full-table totals with synthetic and system-signal filters.';

commit;
