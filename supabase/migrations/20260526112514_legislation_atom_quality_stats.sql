-- M10 PR-C: atom quality stats for the operator hub
--
-- Three signals in one RPC call:
-- 1. Tier histogram — counts per confidence band, matches the
--    rubric tiers locked in by PR #110/#111 (>=0.90, 0.70–0.89,
--    0.50–0.69, <0.50).
-- 2. Missing-reasoning count — atoms with confidence_reasoning IS
--    NULL. Surfaces pre-Option-D atoms that need re-extraction
--    and acts as a "is the LLM honoring the new prompt?" check
--    when new ingests are running.
-- 3. Reasoning uniformity — first-3-words prefix grouping over
--    the most recent 100 atoms. If the top prefix's share crosses
--    a threshold AND we have enough data, it's flagged as
--    anchored. This is the textual analogue of the uniform-0.95
--    failure mode that motivated the whole calibration thread.
--
-- The 100-atom window is intentional: corpus-wide aggregation
-- would dilute the signal as the corpus grows past a few hundred
-- atoms. Recent-window catches the "current ingest run is
-- producing template responses" failure mode directly.

create or replace function works.legislation_atom_quality_stats(
  recent_window int default 100,
  anchoring_threshold numeric default 0.6,
  min_atoms_for_anchoring_check int default 5
)
returns table (
  tier_high_count bigint,
  tier_med_count bigint,
  tier_low_count bigint,
  tier_critical_count bigint,
  missing_reasoning_count bigint,
  total_count bigint,
  top_reasoning_prefix text,
  top_reasoning_count bigint,
  top_reasoning_share numeric,
  is_anchored boolean
)
language sql
stable
set search_path = works, public
as $$
  with recent as (
    select confidence, confidence_reasoning
    from works.legislation_obligation_atoms
    order by created_at desc
    limit recent_window
  ),
  prefixes as (
    -- First 3 whitespace-collapsed words, lowercased.
    -- regexp_replace normalizes runs of whitespace (newlines,
    -- tabs) so the prefix grouping doesn't fragment on the
    -- accidental "actor + action\nexplicit" two-line case.
    select lower(array_to_string(
      (string_to_array(regexp_replace(confidence_reasoning, '\s+', ' ', 'g'), ' '))[1:3],
      ' '
    )) as prefix
    from recent
    where confidence_reasoning is not null
      and length(trim(confidence_reasoning)) > 0
  ),
  prefix_counts as (
    select prefix, count(*)::bigint as n
    from prefixes
    where prefix <> ''
    group by prefix
    order by n desc
    limit 1
  ),
  totals as (
    select
      count(*) filter (where confidence >= 0.90)::bigint as tier_high,
      count(*) filter (where confidence >= 0.70 and confidence < 0.90)::bigint as tier_med,
      count(*) filter (where confidence >= 0.50 and confidence < 0.70)::bigint as tier_low,
      count(*) filter (where confidence < 0.50)::bigint as tier_critical,
      count(*) filter (where confidence_reasoning is null)::bigint as missing_reasoning,
      count(*)::bigint as total
    from recent
  )
  select
    t.tier_high,
    t.tier_med,
    t.tier_low,
    t.tier_critical,
    t.missing_reasoning,
    t.total,
    p.prefix,
    coalesce(p.n, 0::bigint),
    case when t.total > 0 and p.n is not null
      then round(p.n::numeric / t.total::numeric, 3)
      else 0::numeric
    end,
    case
      when t.total >= min_atoms_for_anchoring_check
        and p.n is not null
        and (p.n::numeric / t.total::numeric) > anchoring_threshold
      then true
      else false
    end
  from totals t
  left join prefix_counts p on true;
$$;

grant execute on function works.legislation_atom_quality_stats(int, numeric, int) to authenticated, service_role;

comment on function works.legislation_atom_quality_stats(int, numeric, int) is
  'Operator hub quality panel: per-tier counts, missing-reasoning count, and anchoring-drift detection via first-3-words prefix grouping over the most recent N atoms. Defaults: window=100, threshold=0.6 share, min=5 atoms. SECURITY INVOKER + RLS on legislation_obligation_atoms ensures authenticated callers see only atoms they can already read; service_role bypasses for cron/admin use.';;
