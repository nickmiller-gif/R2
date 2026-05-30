-- Writer-level MEG provenance: the works.entities <-> public.entities sync
-- triggers create public.meg_entities rows but never recorded a
-- public.meg_entity_source_refs row, leaving synced entities without
-- provenance (observed: 52 active entities tagged synced_from=works.entities /
-- public.entities with no source ref). public.ensure_client_meg_linkage already
-- records a source ref; this migration brings the two sync triggers in line so
-- every entity they mint carries a deterministic provenance ref going forward.
--
-- Provenance is derived from the triggering row's own primary key (works.entities.id
-- / public.entities.id) — no fabrication. Idempotent via ON CONFLICT DO NOTHING.

CREATE OR REPLACE FUNCTION works.entities_sync_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'works', 'pg_temp'
AS $function$
declare
  v_user_id uuid;
  v_pub_type text;
  v_meg_type text;
  v_meg_id uuid;
  v_label text;
  v_guard_on boolean;
begin
  v_guard_on := (current_setting('app.entity_sync_in_progress', true) = 'on');
  v_label := coalesce(nullif(new.label, ''), 'Unnamed entity');

  if new.meg_entity_id is not null then
    v_meg_id := new.meg_entity_id;
  else
    if new.metadata ? 'meg_entity_id'
       and length(coalesce(new.metadata ->> 'meg_entity_id', '')) = 36 then
      begin
        v_meg_id := (new.metadata ->> 'meg_entity_id')::uuid;
      exception when others then
        v_meg_id := null;
      end;
    end if;
    if v_meg_id is null then
      select id into v_meg_id
      from public.meg_entities
      where canonical_name = v_label and status = 'active'
      limit 1;
    end if;
    if v_meg_id is not null then
      update works.entities set meg_entity_id = v_meg_id where id = new.id;
    end if;
  end if;

  if v_guard_on then return new; end if;
  perform set_config('app.entity_sync_in_progress', 'on', true);

  v_pub_type := works._map_kind_to_entity_type(new.kind);
  v_meg_type := works._map_kind_to_meg_type(new.kind);

  if v_meg_id is null then
    insert into public.meg_entities (entity_type, canonical_name, status, external_ids, attributes, metadata)
    values (v_meg_type::public.meg_entity_type, v_label, 'active'::public.meg_entity_status,
            jsonb_build_object('works_entity_id', new.id::text), '{}'::jsonb,
            jsonb_build_object('synced_from', 'works.entities', 'works_kind', new.kind))
    returning id into v_meg_id;
    if v_meg_id is not null and new.meg_entity_id is distinct from v_meg_id then
      update works.entities set meg_entity_id = v_meg_id where id = new.id;
    end if;
  end if;

  -- Writer-level provenance: record the works.entities -> meg_entities mapping.
  if v_meg_id is not null then
    insert into public.meg_entity_source_refs (
      meg_entity_id, source_system, source_table, source_row_id,
      source_row_pk_type, resolver_version
    ) values (
      v_meg_id, 'works', 'entities', new.id::text,
      'uuid', 'works_entities_sync_v1'
    )
    on conflict do nothing;
  end if;

  begin v_user_id := auth.uid(); exception when others then v_user_id := null; end;
  if v_user_id is null then v_user_id := works._default_entity_operator(); end if;

  if v_user_id is not null then
    insert into public.entities (user_id, name, type, status, source_system, meg_entity_id, meg_canonical_id, tags, visibility)
    select v_user_id, v_label, v_pub_type::public.entity_type, 'active', 'works_sync',
      v_meg_id::text, v_meg_id::text, '{}'::text[], 'authenticated'::public.visibility_level
    where not exists (
      select 1 from public.entities e where e.user_id = v_user_id and e.name = v_label and e.status = 'active'
    );
  end if;

  perform set_config('app.entity_sync_in_progress', 'off', true);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.entities_sync_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'works', 'pg_temp'
AS $function$
declare v_meg_id uuid; v_meg_type text; v_works_kind text;
begin
  if current_setting('app.entity_sync_in_progress', true) = 'on' then return new; end if;
  perform set_config('app.entity_sync_in_progress', 'on', true);

  v_works_kind := works._map_entity_type_to_kind(new.type::text);
  v_meg_type := works._map_kind_to_meg_type(v_works_kind);

  insert into public.meg_entities (entity_type, canonical_name, status, external_ids, attributes, metadata)
  select v_meg_type::public.meg_entity_type, new.name, 'active'::public.meg_entity_status,
    jsonb_build_object('public_entity_id', new.id::text), '{}'::jsonb,
    jsonb_build_object('synced_from', 'public.entities', 'public_type', new.type::text)
  where not exists (select 1 from public.meg_entities m where m.canonical_name = new.name and m.status = 'active')
  returning id into v_meg_id;
  if v_meg_id is null then
    select id into v_meg_id from public.meg_entities where canonical_name = new.name and status = 'active' limit 1;
  end if;

  if v_meg_id is not null and new.meg_entity_id is null then
    update public.entities set meg_entity_id = v_meg_id::text, meg_canonical_id = v_meg_id::text where id = new.id;
  end if;

  -- Writer-level provenance: record the public.entities -> meg_entities mapping.
  if v_meg_id is not null then
    insert into public.meg_entity_source_refs (
      meg_entity_id, source_system, source_table, source_row_id,
      source_row_pk_type, resolver_version
    ) values (
      v_meg_id, 'public', 'entities', new.id::text,
      'uuid', 'public_entities_sync_v1'
    )
    on conflict do nothing;
  end if;

  insert into works.entities (kind, label, metadata)
  select v_works_kind, new.name,
    jsonb_build_object('synced_from', 'public.entities', 'public_entity_id', new.id::text,
      'public_type', new.type::text, 'meg_entity_id', coalesce(v_meg_id::text, ''))
  where not exists (select 1 from works.entities w where w.label = new.name);

  perform set_config('app.entity_sync_in_progress', 'off', true);
  return new;
end;
$function$;
