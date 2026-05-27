create or replace function works.resolve_concept_normalize(
  p_concept_id text,
  p_jurisdictions text[] default '{}'::text[]
)
returns table (
  concept_id          text,
  concept_label       text,
  concept_kind        text,
  concept_definition  text,
  aliases_by_jurisdiction jsonb,
  atoms_by_jurisdiction   jsonb,
  jurisdiction_count  int,
  alias_count         int,
  atom_count          int
)
language sql
stable
security invoker
set search_path = works, public, pg_temp
as $body$
  with target as (
    select c.id, c.label, c.kind, c.definition
    from works.legislation_concepts c
    where c.id = p_concept_id
  ),
  aliases as (
    select
      coalesce(a.jurisdiction, '_global') as juris,
      array_agg(distinct a.alias_text order by a.alias_text) as alias_terms,
      array_agg(distinct a.source_note) filter (where a.source_note is not null) as source_notes
    from works.legislation_concept_aliases a
    where a.concept_id = p_concept_id
    group by coalesce(a.jurisdiction, '_global')
  ),
  atoms_raw as (
    select
      d.jurisdiction,
      jsonb_build_object(
        'atom_id', a.id,
        'role', ac.role,
        'provision_section', p.section_path,
        'provision_text', p.text,
        'document_title', d.title,
        'document_identifier', d.identifier,
        'document_lifecycle_state', d.lifecycle_state,
        'document_effective_at', d.effective_at,
        'confidence', a.confidence
      ) as atom_payload,
      d.effective_at,
      a.confidence,
      a.created_at
    from works.legislation_atom_concepts ac
    join works.legislation_obligation_atoms a on a.id = ac.atom_id
    join works.legislation_provisions p on p.id = a.provision_id
    join works.legislation_documents d on d.id = p.document_id
    where ac.concept_id = p_concept_id
      and d.lifecycle_state in ('signed', 'effective', 'amended')
      and (
        cardinality(coalesce(p_jurisdictions, '{}'::text[])) = 0
        or d.jurisdiction = any(coalesce(p_jurisdictions, '{}'::text[]))
      )
  ),
  atoms_grouped as (
    select
      jurisdiction,
      jsonb_agg(atom_payload order by effective_at desc nulls last, confidence desc, created_at desc) as atoms
    from atoms_raw
    group by jurisdiction
  )
  select
    (select id from target)         as concept_id,
    (select label from target)      as concept_label,
    (select kind from target)       as concept_kind,
    (select definition from target) as concept_definition,
    coalesce(
      (select jsonb_object_agg(juris, jsonb_build_object(
        'alias_terms', alias_terms,
        'source_notes', source_notes
      )) from aliases),
      '{}'::jsonb
    ) as aliases_by_jurisdiction,
    coalesce(
      (select jsonb_object_agg(jurisdiction, atoms) from atoms_grouped),
      '{}'::jsonb
    ) as atoms_by_jurisdiction,
    (
      select count(distinct juris)::int
      from (
        select juris from aliases where juris <> '_global'
        union
        select jurisdiction as juris from atoms_grouped
      ) u
    ) as jurisdiction_count,
    (select coalesce(sum(cardinality(alias_terms)), 0)::int from aliases) as alias_count,
    (select coalesce(sum(jsonb_array_length(atoms)), 0)::int from atoms_grouped) as atom_count
$body$;

grant execute on function works.resolve_concept_normalize(text, text[])
  to authenticated, service_role;

comment on function works.resolve_concept_normalize(text, text[]) is
  'Phase 3 normalize mode: given a concept_id, returns the per-jurisdiction aliases + the obligation atoms in each jurisdiction that touch the concept. Optional p_jurisdictions filter narrows to a subset. Only enacted documents contribute atoms.';;
