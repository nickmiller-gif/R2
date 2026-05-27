create table if not exists works.legislation_jurisdiction_aliases (
  alias_text         text not null,
  jurisdiction_code  text not null,
  source_note        text,
  created_at         timestamptz not null default now(),
  primary key (alias_text, jurisdiction_code)
);

create index if not exists legislation_jurisdiction_aliases_text_trgm_idx
  on works.legislation_jurisdiction_aliases
  using gin (alias_text gin_trgm_ops);

comment on table works.legislation_jurisdiction_aliases is
  'Phase 5c: maps operator-supplied free-text jurisdiction strings (lowercased) to canonical ISO-shaped jurisdiction codes used in works.legislation_documents.jurisdiction. find_provisions_for_concepts uses this to normalize before applying the ILIKE filter.';

insert into works.legislation_jurisdiction_aliases (alias_text, jurisdiction_code, source_note) values
  ('california',         'us-ca', 'state name (full)'),
  ('california, usa',    'us-ca', 'state name + country qualifier'),
  ('ca',                 'us-ca', 'state abbreviation'),
  ('cal',                'us-ca', 'common short form'),
  ('us-ca',              'us-ca', 'canonical (identity)'),
  ('new york city',      'us-ny-nyc', 'city name (full)'),
  ('nyc',                'us-ny-nyc', 'city abbreviation'),
  ('new york, ny',       'us-ny-nyc', 'common framing'),
  ('us-ny-nyc',          'us-ny-nyc', 'canonical (identity)'),
  ('colorado',           'us-co', 'state name (full)'),
  ('co',                 'us-co', 'state abbreviation'),
  ('us-co',              'us-co', 'canonical (identity)'),
  ('illinois',           'us-il', 'state name (full)'),
  ('il',                 'us-il', 'state abbreviation'),
  ('us-il',              'us-il', 'canonical (identity)'),
  ('us federal',         'us-federal', 'level name'),
  ('federal',            'us-federal', 'when context is US legal'),
  ('united states',      'us-federal', 'country-level fallback'),
  ('usa',                'us-federal', 'country abbreviation'),
  ('us',                 'us-federal', 'short country abbreviation'),
  ('us-federal',         'us-federal', 'canonical (identity)'),
  ('european union',     'eu', 'bloc name (full)'),
  ('eu',                 'eu', 'bloc abbreviation'),
  ('united kingdom',     'uk', 'country name (full)'),
  ('uk',                 'uk', 'country abbreviation'),
  ('britain',            'uk', 'colloquial — covers most pre-Brexit AI guidance'),
  ('canada',             'ca-federal', 'country name'),
  ('australia',          'au',  'country name'),
  ('singapore',          'sg', 'country / city-state name')
on conflict (alias_text, jurisdiction_code) do nothing;

grant select on works.legislation_jurisdiction_aliases to authenticated;

create or replace function works.resolve_jurisdiction(p_text text)
returns text[]
language sql
stable
security invoker
set search_path = works, public, pg_temp
as $body$
  with input as (
    select coalesce(trim(lower(p_text)), '') as needle
  )
  select coalesce(array_agg(distinct jurisdiction_code), '{}'::text[])
  from works.legislation_jurisdiction_aliases a, input i
  where i.needle <> ''
    and (
      a.alias_text = i.needle
      or a.alias_text ilike '%' || i.needle || '%'
      or i.needle ilike '%' || a.alias_text || '%'
    );
$body$;

grant execute on function works.resolve_jurisdiction(text) to authenticated, service_role;

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
      when p_jurisdiction is null or p_jurisdiction = '' then '{}'::text[]
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
      or p_jurisdiction = ''
      or (
        cardinality(r.codes) > 0
        and d.jurisdiction = any(r.codes)
      )
      or (
        cardinality(r.codes) = 0
        and d.jurisdiction ilike '%' || p_jurisdiction || '%'
      )
    )
  order by s.match_score desc, d.effective_at desc nulls last, a.created_at desc
  limit greatest(1, least(coalesce(p_max_atoms, 25), 100))
$body$;

grant execute on function works.find_provisions_for_concepts(text[], text, int)
  to authenticated, service_role;

comment on function works.find_provisions_for_concepts(text[], text, int) is
  'Phase 5c: jurisdiction filter normalizes operator free text to canonical ISO codes via resolve_jurisdiction; falls back to ILIKE for unseeded jurisdictions.';;
