-- Operator feed: distinguish synthetic/test ingest from live producer traffic.

begin;

update public.platform_feed_items
set provenance = coalesce(provenance, '{}'::jsonb) || jsonb_build_object('is_synthetic', true)
where (provenance->>'is_synthetic') is distinct from 'true'
  and (
    source_event_type in ('kb_four_smoke', 'stream_a_closeout', 'r2.signal.ingest.probe')
    or summary ilike '%[SMOKE]%'
    or summary ilike '%Connectivity verify%'
    or (provenance->>'closeout_smoke') = 'true'
    or (provenance->>'connectivity_verify') = 'true'
  );

create or replace function public.platform_feed_item_is_synthetic(
  p_source_event_type text,
  p_summary text,
  p_provenance jsonb
)
returns boolean
language sql
immutable
as $$
  select
    coalesce((p_provenance->>'is_synthetic')::boolean, false)
    or p_source_event_type in ('kb_four_smoke', 'stream_a_closeout', 'r2.signal.ingest.probe')
    or coalesce(p_summary, '') ilike '%[SMOKE]%'
    or coalesce(p_summary, '') ilike '%Connectivity verify%'
    or coalesce(p_provenance->>'closeout_smoke', '') = 'true'
    or coalesce(p_provenance->>'connectivity_verify', '') = 'true';
$$;

comment on function public.platform_feed_item_is_synthetic is
  'True for CLI smokes, closeout scripts, and connectivity-verify rows — not live KB-four producer traffic.';

commit;;
