-- Post-merge: register canonical hardening migration (DDL idempotent on prod)
create extension if not exists pg_trgm;

alter table works.legislation_jurisdiction_aliases
  drop constraint if exists legislation_jurisdiction_aliases_alias_text_normalized;

alter table works.legislation_jurisdiction_aliases
  add constraint legislation_jurisdiction_aliases_alias_text_normalized
  check (alias_text = lower(alias_text) and alias_text = trim(alias_text) and alias_text <> '');

create or replace function works.resolve_jurisdiction(p_text text)
returns text[]
language sql
stable
security invoker
set search_path = works, public, pg_temp
as $body$
  with input as (
    select coalesce(trim(lower(p_text)), '') as needle
  ),
  exact_matches as (
    select a.jurisdiction_code
    from works.legislation_jurisdiction_aliases a, input i
    where i.needle <> '' and a.alias_text = i.needle
  ),
  fuzzy_matches as (
    select a.jurisdiction_code
    from works.legislation_jurisdiction_aliases a, input i
    where i.needle <> ''
      and char_length(i.needle) >= 3
      and char_length(a.alias_text) >= 3
      and a.alias_text ilike '%' || i.needle || '%'
      and not exists (select 1 from exact_matches)
  )
  select coalesce(array_agg(distinct jurisdiction_code), '{}'::text[])
  from (
    select jurisdiction_code from exact_matches
    union
    select jurisdiction_code from fuzzy_matches
  ) j;
$body$;

create or replace function works.find_provisions_for_concepts(
  p_concept_ids text[],
  p_jurisdiction text default null,
  p_max_atoms int default 25
)
returns table (
  atom_id            uuid,
  match_score        int,
  matched_via        text[],
  actor_concept_id   text,
  action_concept_id  text,
  trigger_jsonb      jsonb,
  threshold_jsonb    jsonb,
  exception_jsonb    jsonb,
  consequence_jsonb  jsonb,
  effective_date     date,
  atom_confidence    numeric,
  provision_id       uuid,
  provision_section  text,
  provision_text     text,
  document_id        uuid,
  document_title     text,
  document_identifier text,
  document_jurisdiction text,
  document_doc_type   text,
  document_effective_at date,
  document_lifecycle_state text
)
language sql
stable
security invoker
set search_path = works, public, pg_temp
as $body$
  with input_concepts as (
    select unnest(p_concept_ids) as concept_id
  ),
  resolved_codes as (
    select case
      when p_jurisdiction is null or trim(p_jurisdiction) = '' then '{}'::text[]
      else works.resolve_jurisdiction(p_jurisdiction)
    end as codes
  ),
  via_actor as (
    select a.id as atom_id, 'actor'::text as via, a.actor_concept_id as matched_concept
    from works.legislation_obligation_atoms a
    join input_concepts ic on ic.concept_id = a.actor_concept_id
  ),
  via_action as (
    select a.id as atom_id, 'action'::text as via, a.action_concept_id as matched_concept
    from works.legislation_obligation_atoms a
    join input_concepts ic on ic.concept_id = a.action_concept_id
  ),
  via_tag as (
    select ac.atom_id as atom_id, 'tag'::text as via, ac.concept_id as matched_concept
    from works.legislation_atom_concepts ac
    join input_concepts ic on ic.concept_id = ac.concept_id
  ),
  matched as (
    select * from via_actor
    union all select * from via_action
    union all select * from via_tag
  ),
  scored as (
    select
      m.atom_id,
      count(distinct m.matched_concept) as match_score,
      array_agg(distinct m.via order by m.via) as matched_via
    from matched m
    group by m.atom_id
  )
  select
    a.id as atom_id,
    s.match_score::int,
    s.matched_via,
    a.actor_concept_id,
    a.action_concept_id,
    a.trigger_jsonb,
    a.threshold_jsonb,
    a.exception_jsonb,
    a.consequence_jsonb,
    a.effective_date,
    a.confidence as atom_confidence,
    p.id as provision_id,
    p.section_path as provision_section,
    p.text as provision_text,
    d.id as document_id,
    d.title as document_title,
    d.identifier as document_identifier,
    d.jurisdiction as document_jurisdiction,
    d.doc_type as document_doc_type,
    d.effective_at as document_effective_at,
    d.lifecycle_state as document_lifecycle_state
  from scored s
  join works.legislation_obligation_atoms a on a.id = s.atom_id
  join works.legislation_provisions p on p.id = a.provision_id
  join works.legislation_documents d on d.id = p.document_id
  cross join resolved_codes r
  where
    d.lifecycle_state in ('signed', 'effective', 'amended')
    and (
      p_jurisdiction is null
      or trim(p_jurisdiction) = ''
      or (
        cardinality(r.codes) > 0
        and d.jurisdiction = any(r.codes)
      )
      or (
        cardinality(r.codes) = 0
        and d.jurisdiction ilike '%' || trim(p_jurisdiction) || '%'
      )
    )
  order by s.match_score desc, d.effective_at desc nulls last, a.created_at desc
  limit greatest(1, least(coalesce(p_max_atoms, 25), 100))
$body$;;
