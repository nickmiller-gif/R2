create or replace function works.resolve_use_case_project(
  p_actor_role text,
  p_subject_concepts text[],
  p_jurisdictions text[] default '{}'::text[],
  p_max_atoms int default 50
)
returns table (
  total_atoms          int,
  jurisdiction_count   int,
  atoms_by_jurisdiction jsonb,
  matched_actors       text[],
  matched_subjects     text[]
)
language sql
stable
security invoker
set search_path = works, public, pg_temp
as $body$
  with inputs as (
    select
      case
        when p_actor_role is null or trim(p_actor_role) = '' then null
        else 'concept:actor.' || lower(trim(p_actor_role))
      end as actor_id,
      coalesce(p_subject_concepts, '{}'::text[]) as subjects,
      coalesce(p_jurisdictions, '{}'::text[])   as jurisdictions,
      greatest(1, least(coalesce(p_max_atoms, 50), 200)) as cap
  ),
  concept_set as (
    select distinct unnest(
      case
        when i.actor_id is null then i.subjects
        else array_append(i.subjects, i.actor_id)
      end
    ) as concept_id
    from inputs i
    where (i.actor_id is not null or cardinality(i.subjects) > 0)
  ),
  via_actor as (
    select a.id as atom_id, a.actor_concept_id as matched_concept
    from works.legislation_obligation_atoms a
    join concept_set cs on cs.concept_id = a.actor_concept_id
  ),
  via_action as (
    select a.id as atom_id, a.action_concept_id as matched_concept
    from works.legislation_obligation_atoms a
    join concept_set cs on cs.concept_id = a.action_concept_id
  ),
  via_tag as (
    select ac.atom_id, ac.concept_id as matched_concept
    from works.legislation_atom_concepts ac
    join concept_set cs on cs.concept_id = ac.concept_id
  ),
  matched as (
    select * from via_actor
    union all select * from via_action
    union all select * from via_tag
  ),
  scored as (
    select
      m.atom_id,
      count(distinct m.matched_concept)::int as match_score
    from matched m
    group by m.atom_id
  ),
  enriched as (
    select
      s.match_score,
      a.id as atom_id,
      a.actor_concept_id,
      a.action_concept_id,
      a.confidence,
      a.created_at as atom_created_at,
      p.section_path,
      p.text as provision_text,
      d.id as document_id,
      d.title as document_title,
      d.identifier as document_identifier,
      d.jurisdiction,
      d.lifecycle_state as document_lifecycle_state,
      d.effective_at as document_effective_at
    from scored s
    join works.legislation_obligation_atoms a on a.id = s.atom_id
    join works.legislation_provisions p on p.id = a.provision_id
    join works.legislation_documents d on d.id = p.document_id
    cross join inputs i
    where d.lifecycle_state in ('signed', 'effective', 'amended')
      and (
        cardinality(i.jurisdictions) = 0
        or d.jurisdiction = any(i.jurisdictions)
      )
  ),
  ranked as (
    select
      e.*,
      row_number() over (
        order by e.match_score desc, e.document_effective_at desc nulls last,
                 e.confidence desc, e.atom_created_at desc
      ) as rank
    from enriched e
  ),
  capped as (
    select r.*
    from ranked r, inputs i
    where r.rank <= i.cap
  ),
  payload as (
    select
      jurisdiction,
      jsonb_agg(
        jsonb_build_object(
          'atom_id', atom_id,
          'match_score', match_score,
          'actor_concept_id', actor_concept_id,
          'action_concept_id', action_concept_id,
          'confidence', confidence,
          'provision_section', section_path,
          'provision_text', provision_text,
          'document_title', document_title,
          'document_identifier', document_identifier,
          'document_lifecycle_state', document_lifecycle_state,
          'document_effective_at', document_effective_at
        )
        order by match_score desc, document_effective_at desc nulls last, confidence desc
      ) as atoms
    from capped
    group by jurisdiction
  )
  select
    (select coalesce(sum(jsonb_array_length(atoms)), 0)::int from payload) as total_atoms,
    (select coalesce(count(distinct jurisdiction)::int, 0) from payload)   as jurisdiction_count,
    coalesce((select jsonb_object_agg(jurisdiction, atoms) from payload), '{}'::jsonb) as atoms_by_jurisdiction,
    coalesce((select array_agg(distinct actor_concept_id) filter (where actor_concept_id is not null) from capped), '{}'::text[]) as matched_actors,
    coalesce((select array_agg(distinct action_concept_id) filter (where action_concept_id is not null) from capped), '{}'::text[]) as matched_subjects
$body$;

grant execute on function works.resolve_use_case_project(text, text[], text[], int)
  to authenticated, service_role;;
