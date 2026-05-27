create or replace function public.ensure_client_meg_linkage(
  p_client_id uuid,
  p_client_name text
) returns void
language plpgsql
security definer
set search_path = public, works, pg_temp
as $$
declare
  v_meg_id uuid;
  v_works_id uuid;
  v_name text;
begin
  v_name := coalesce(nullif(trim(p_client_name), ''), 'Unnamed client');

  select id into v_meg_id
  from public.meg_entities
  where status = 'active' and lower(canonical_name) = lower(v_name)
  limit 1;

  if v_meg_id is null then
    perform set_config('app.entity_sync_in_progress', 'on', true);
    insert into public.meg_entities (
      entity_type, canonical_name, status, external_ids, attributes, metadata
    )
    values (
      'org', v_name, 'active', '{}'::jsonb, '{}'::jsonb,
      jsonb_build_object(
        'created_via', 'ensure_client_meg_linkage',
        'linked_client_id', p_client_id::text
      )
    )
    returning id into v_meg_id;
    perform set_config('app.entity_sync_in_progress', 'off', true);
  end if;

  insert into public.meg_entity_source_refs (
    meg_entity_id, source_system, source_table, source_row_id,
    source_row_pk_type, resolver_version
  )
  values (
    v_meg_id, 'works', 'clients', p_client_id::text,
    'uuid', 'ensure_client_meg_linkage_v1'
  )
  on conflict (meg_entity_id, source_table, source_row_id) do nothing;

  select id into v_works_id
  from works.entities
  where meg_entity_id = v_meg_id
  limit 1;

  if v_works_id is not null then
    update works.entities
    set ref_id = p_client_id
    where id = v_works_id
      and ref_id is distinct from p_client_id;
  else
    perform set_config('app.entity_sync_in_progress', 'on', true);
    insert into works.entities (kind, label, ref_id, meg_entity_id, metadata)
    values (
      'org', v_name, p_client_id, v_meg_id,
      jsonb_build_object('synced_from', 'ensure_client_meg_linkage')
    );
    perform set_config('app.entity_sync_in_progress', 'off', true);
  end if;
end;
$$;

revoke all on function public.ensure_client_meg_linkage(uuid, text) from public;
grant execute on function public.ensure_client_meg_linkage(uuid, text)
  to authenticated, service_role;

comment on function public.ensure_client_meg_linkage(uuid, text) is
  'Idempotent MEG <-> works wiring for a public.clients row.';

create or replace function public.clients_ensure_meg_linkage_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, works, pg_temp
as $$
begin
  perform public.ensure_client_meg_linkage(new.id, new.name);
  return new;
end;
$$;

drop trigger if exists trg_clients_ensure_meg_linkage on public.clients;
create trigger trg_clients_ensure_meg_linkage
  after insert or update of name on public.clients
  for each row execute function public.clients_ensure_meg_linkage_trigger();

do $$
declare
  r record;
  v_count int := 0;
begin
  for r in select id, name from public.clients loop
    perform public.ensure_client_meg_linkage(r.id, r.name);
    v_count := v_count + 1;
  end loop;
  raise notice 'ensure_client_meg_linkage backfill: wired % client rows', v_count;
end $$;

do $$
declare v_orphan int;
begin
  select count(*) into v_orphan
  from public.clients c
  where not exists (
    select 1 from public.meg_entity_source_refs r
    where r.source_table = 'clients' and r.source_row_id = c.id::text
  );
  if v_orphan > 0 then
    raise exception 'ensure_client_meg_linkage backfill: % clients still lack a source_ref', v_orphan;
  end if;

  select count(*) into v_orphan
  from public.clients c
  where not exists (
    select 1 from works.entities w where w.ref_id = c.id
  );
  if v_orphan > 0 then
    raise exception 'ensure_client_meg_linkage backfill: % clients still lack a works.entities row with ref_id stamped', v_orphan;
  end if;
end $$;;
