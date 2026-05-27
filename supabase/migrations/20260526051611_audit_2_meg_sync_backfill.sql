do $$
declare
  r record;
  v_works_kind text;
  v_pub_type text;
  v_user_id uuid;
  v_works_id uuid;
  v_backfilled int := 0;
begin
  v_user_id := works._default_entity_operator();
  perform set_config('app.entity_sync_in_progress', 'on', true);

  for r in
    select id, canonical_name, entity_type::text as et
    from public.meg_entities
    where status = 'active'
      and not exists (
        select 1 from works.entities w where w.meg_entity_id = id
      )
  loop
    v_works_kind := works._map_meg_type_to_kind(r.et);
    v_pub_type   := works._map_kind_to_entity_type(v_works_kind);

    insert into works.entities (kind, label, metadata, meg_entity_id)
    values (
      v_works_kind,
      coalesce(nullif(r.canonical_name, ''), 'Unnamed entity'),
      jsonb_build_object(
        'synced_from', 'audit_2_backfill',
        'meg_entity_id', r.id::text,
        'meg_entity_type', r.et
      ),
      r.id
    )
    returning id into v_works_id;

    if v_user_id is not null then
      insert into public.entities (
        user_id, name, type, status, source_system,
        meg_entity_id, meg_canonical_id, tags, visibility
      )
      select
        v_user_id,
        coalesce(nullif(r.canonical_name, ''), 'Unnamed entity'),
        v_pub_type::public.entity_type,
        'active',
        'meg_backfill',
        r.id::text,
        r.id::text,
        '{}'::text[],
        'authenticated'::public.visibility_level
      where not exists (
        select 1 from public.entities e
        where e.user_id = v_user_id
          and e.name = coalesce(nullif(r.canonical_name, ''), 'Unnamed entity')
          and e.status = 'active'
      );
    end if;

    v_backfilled := v_backfilled + 1;
  end loop;

  perform set_config('app.entity_sync_in_progress', 'off', true);

  raise notice 'audit_2_meg_sync_backfill: backfilled % meg rows into works/public', v_backfilled;
end $$;

do $$
declare
  v_remaining int;
begin
  select count(*) into v_remaining
  from public.meg_entities m
  where m.status = 'active'
    and not exists (select 1 from works.entities w where w.meg_entity_id = m.id);
  if v_remaining > 0 then
    raise exception 'audit_2_meg_sync_backfill: % active meg rows still missing works mirror after backfill', v_remaining;
  end if;
end $$;;
