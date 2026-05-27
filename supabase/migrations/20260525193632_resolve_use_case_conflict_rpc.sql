create or replace function works.resolve_use_case_conflict(
  p_actor_role text default null,
  p_subject_concepts text[] default '{}'::text[],
  p_jurisdictions text[] default '{}'::text[],
  p_max_pairs int default 50
)
returns table (
  total_pairs        int,
  jurisdiction_count int,
  pairs              jsonb
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
      greatest(1, least(coalesce(p_max_pairs, 50), 200)) as cap
  ),
  candidate_atoms as (
    select distinct a.id as atom_id
    from works.legislation_obligation_atoms a
    cross join inputs i
    where (
      (i.actor_id is null and cardinality(i.subjects) = 0)
      or a.actor_concept_id = i.actor_id
      or a.action_concept_id = any(i.subjects)
      or exists (
        select 1 from works.legislation_atom_concepts ac
        where ac.atom_id = a.id
          and (ac.concept_id = i.actor_id or ac.concept_id = any(i.subjects))
      )
    )
  ),
  enriched as (
    select
      a.id as atom_id,
      a.actor_concept_id,
      a.action_concept_id,
      a.trigger_jsonb,
      a.threshold_jsonb,
      a.exception_jsonb,
      a.consequence_jsonb,
      a.confidence,
      a.created_at,
      p.section_path,
      p.text as provision_text,
      d.jurisdiction,
      d.title as document_title,
      d.identifier as document_identifier,
      d.lifecycle_state as document_lifecycle_state,
      d.effective_at as document_effective_at
    from candidate_atoms ca
    join works.legislation_obligation_atoms a on a.id = ca.atom_id
    join works.legislation_provisions p on p.id = a.provision_id
    join works.legislation_documents d on d.id = p.document_id
    cross join inputs i
    where d.lifecycle_state in ('signed', 'effective', 'amended')
      and a.actor_concept_id is not null
      and a.action_concept_id is not null
      and (
        cardinality(i.jurisdictions) = 0
        or d.jurisdiction = any(i.jurisdictions)
      )
  ),
  pair_summary as (
    select
      actor_concept_id,
      action_concept_id,
      count(distinct jurisdiction)::int as juris_n,
      array_agg(distinct jurisdiction order by jurisdiction) as juris_list
    from enriched
    group by actor_concept_id, action_concept_id
    having count(distinct jurisdiction) >= 2
  ),
  ranked_pairs as (
    select
      ps.actor_concept_id,
      ps.action_concept_id,
      ps.juris_n,
      ps.juris_list,
      row_number() over (
        order by ps.juris_n desc,
                 (select count(*) from enriched e
                  where e.actor_concept_id = ps.actor_concept_id
                    and e.action_concept_id = ps.action_concept_id) desc
      ) as rank
    from pair_summary ps
  ),
  capped_pairs as (
    select rp.*
    from ranked_pairs rp, inputs i
    where rp.rank <= i.cap
  ),
  per_juris as (
    select
      cp.actor_concept_id,
      cp.action_concept_id,
      e.jurisdiction,
      jsonb_agg(
        jsonb_build_object(
          'atom_id', e.atom_id,
          'provision_section', e.section_path,
          'provision_text', e.provision_text,
          'document_title', e.document_title,
          'document_identifier', e.document_identifier,
          'document_lifecycle_state', e.document_lifecycle_state,
          'document_effective_at', e.document_effective_at,
          'trigger', e.trigger_jsonb,
          'threshold', e.threshold_jsonb,
          'exception', e.exception_jsonb,
          'consequence', e.consequence_jsonb,
          'confidence', e.confidence
        )
        order by e.document_effective_at desc nulls last, e.confidence desc
      ) as atoms
    from capped_pairs cp
    join enriched e on e.actor_concept_id = cp.actor_concept_id
                    and e.action_concept_id = cp.action_concept_id
    group by cp.actor_concept_id, cp.action_concept_id, e.jurisdiction
  ),
  pair_payload as (
    select
      cp.actor_concept_id,
      cp.action_concept_id,
      cp.juris_n,
      cp.juris_list,
      jsonb_object_agg(pj.jurisdiction, pj.atoms) as per_jurisdiction
    from capped_pairs cp
    join per_juris pj on pj.actor_concept_id = cp.actor_concept_id
                     and pj.action_concept_id = cp.action_concept_id
    group by cp.actor_concept_id, cp.action_concept_id, cp.juris_n, cp.juris_list
  )
  select
    (select count(*)::int from capped_pairs)                                          as total_pairs,
    (select count(distinct jurisdiction)::int from enriched)                          as jurisdiction_count,
    coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'actor_concept_id', actor_concept_id,
          'action_concept_id', action_concept_id,
          'jurisdiction_count', juris_n,
          'jurisdictions', juris_list,
          'per_jurisdiction', per_jurisdiction
        )
        order by juris_n desc
      ) from pair_payload),
      '[]'::jsonb
    ) as pairs
$body$;

grant execute on function works.resolve_use_case_conflict(text, text[], text[], int)
  to authenticated, service_role;;
