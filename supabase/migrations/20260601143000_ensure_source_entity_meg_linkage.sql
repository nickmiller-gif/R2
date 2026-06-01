-- Wire external producer rows (e.g. CentralR2 Tower `entities`) into Eigen
-- meg_entities + works.entities so Operator Workbench graph/modules see them.

begin;

create or replace function public.ensure_source_entity_meg_linkage(
  p_source_system text,
  p_source_table text,
  p_source_row_id uuid,
  p_label text,
  p_works_kind text,
  p_meg_entity_id uuid default null,
  p_meg_catalog_entity_type text default 'meg:org'
)
returns uuid
language plpgsql
security definer
set search_path = public, works, pg_temp
as $$
declare
  v_meg_id uuid;
  v_works_id uuid;
  v_label text;
  v_kind text;
begin
  v_label := coalesce(nullif(trim(p_label), ''), 'Unnamed entity');
  v_kind := coalesce(nullif(trim(p_works_kind), ''), 'org');

  if p_meg_entity_id is not null then
    select id into v_meg_id
    from public.meg_entities
    where id = p_meg_entity_id and status = 'active';
    if v_meg_id is null then
      raise exception 'ensure_source_entity_meg_linkage: meg_entity_id % not found or inactive', p_meg_entity_id;
    end if;
  else
    v_meg_id := public.meg_resolve_or_create(
      coalesce(nullif(trim(p_meg_catalog_entity_type), ''), 'meg:org'),
      v_label,
      null,
      null,
      p_source_system,
      p_source_table,
      p_source_row_id::text,
      jsonb_build_object('created_via', 'ensure_source_entity_meg_linkage')
    );
  end if;

  insert into public.meg_entity_source_refs (
    meg_entity_id, source_system, source_table, source_row_id,
    source_row_pk_type, resolver_version
  )
  values (
    v_meg_id, p_source_system, p_source_table, p_source_row_id::text,
    'uuid', 'ensure_source_entity_meg_linkage_v1'
  )
  on conflict (meg_entity_id, source_table, source_row_id) do nothing;

  update public.meg_entities m
  set
    canonical_name = left(v_label, 500),
    updated_at = now(),
    metadata = jsonb_strip_nulls(
      coalesce(m.metadata, '{}'::jsonb) ||
      jsonb_build_object(
        'linked_source_system', p_source_system,
        'linked_source_table', p_source_table,
        'linked_source_row_id', p_source_row_id::text
      )
    )
  where m.id = v_meg_id
    and m.canonical_name is distinct from left(v_label, 500);

  select id into v_works_id
  from works.entities
  where meg_entity_id = v_meg_id
  limit 1;

  if v_works_id is null then
    select id into v_works_id
    from works.entities
    where lower(label) = lower(v_label)
      and kind = v_kind
    limit 1;
  end if;

  if v_works_id is not null then
    update works.entities
    set
      meg_entity_id = v_meg_id,
      label = v_label,
      metadata = jsonb_strip_nulls(
        coalesce(metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'synced_from', p_source_system || '.' || p_source_table,
          'source_row_id', p_source_row_id::text,
          'meg_entity_id', v_meg_id::text
        )
      )
    where id = v_works_id;
  else
    perform set_config('app.entity_sync_in_progress', 'on', true);
    insert into works.entities (kind, label, meg_entity_id, metadata)
    values (
      v_kind,
      v_label,
      v_meg_id,
      jsonb_build_object(
        'synced_from', p_source_system || '.' || p_source_table,
        'source_row_id', p_source_row_id::text,
        'meg_entity_id', v_meg_id::text
      )
    )
    returning id into v_works_id;
    perform set_config('app.entity_sync_in_progress', 'off', true);
  end if;

  return v_works_id;
end;
$$;

revoke all on function public.ensure_source_entity_meg_linkage(
  text, text, uuid, text, text, uuid, text
) from public;

grant execute on function public.ensure_source_entity_meg_linkage(
  text, text, uuid, text, text, uuid, text
) to service_role;

comment on function public.ensure_source_entity_meg_linkage(
  text, text, uuid, text, text, uuid, text
) is
  'Idempotent MEG + works.entities wiring for external producer rows (CentralR2 entities, etc.).';

commit;
