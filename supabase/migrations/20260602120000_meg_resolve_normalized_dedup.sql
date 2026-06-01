-- Cross-source MEG dedup: merge CentralR2, R2Works, and other producers when
-- normalized identity keys match (property address + city + state, org/person names).

begin;

create or replace function public.meg_normalize_text_core(p_input text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $body$
  select regexp_replace(
    regexp_replace(lower(btrim(coalesce(p_input, ''))), '\s+', ' ', 'g'),
    '[^a-z0-9 ]+',
    ' ',
    'g'
  );
$body$;

create or replace function public.meg_expand_street_tokens(p_input text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $body$
  select trim(both ' ' from regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(coalesce(p_input, ''), '\mst\M', 'street', 'gi'),
                  '\mstr\M', 'street', 'gi'
                ),
                '\mave\M', 'avenue', 'gi'
              ),
              '\mav\M', 'avenue', 'gi'
            ),
            '\mrd\M', 'road', 'gi'
          ),
          '\mbr\M', 'boulevard', 'gi'
        ),
        '\mblvd\M', 'boulevard', 'gi'
      ),
      '\mdr\M', 'drive', 'gi'
    ),
    '\mln\M', 'lane', 'gi'
  ));
$body$;

create or replace function public.meg_catalog_entity_family(p_catalog text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $body$
  select case
    when coalesce(p_catalog, '') like 'meg:property%' then 'property'
    when coalesce(p_catalog, '') like 'meg:person%' then 'person'
    when coalesce(p_catalog, '') in ('meg:org', 'meg:company') then 'org'
    when coalesce(p_catalog, '') like 'meg:org%' then 'org'
    else lower(btrim(coalesce(p_catalog, 'unknown')))
  end;
$body$;

create or replace function public.meg_normalize_property_dedup_key(
  p_name text,
  p_address text,
  p_city text,
  p_state text
)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $body$
  with norm as (
    select
      public.meg_expand_street_tokens(public.meg_normalize_text_core(p_address)) as addr,
      public.meg_normalize_text_core(p_city) as city,
      upper(left(regexp_replace(coalesce(p_state, ''), '[^a-zA-Z]', '', 'g'), 2)) as state,
      public.meg_expand_street_tokens(public.meg_normalize_text_core(p_name)) as pname
  ),
  core as (
    select case
      when addr <> '' and city <> '' and length(state) = 2 then addr || '|' || city || '|' || state
      when pname <> '' and city <> '' and length(state) = 2 then pname || '|' || city || '|' || state
      when pname <> '' then pname
      else null
    end as v
    from norm
  )
  select case when v is null then null else 'prop:' || md5(v) end
  from core;
$body$;

create or replace function public.meg_normalize_org_dedup_key(p_name text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $body$
  with stripped as (
    select regexp_replace(
      public.meg_normalize_text_core(p_name),
      '\s+(llc|l\.l\.c\.?|inc|incorporated|corp|corporation|lp|l\.p\.?|llp|trust|co|company)\.?\s*$',
      '',
      'gi'
    ) as core
  )
  select case
    when (select core from stripped) = '' then null
    else 'org:' || md5((select core from stripped))
  end;
$body$;

create or replace function public.meg_normalize_person_dedup_key(p_name text, p_email text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $body$
  select case
    when nullif(lower(btrim(coalesce(p_email, ''))), '') is not null then
      'person:em:' || md5(lower(btrim(p_email)))
    when public.meg_normalize_text_core(p_name) <> '' then
      'person:nm:' || md5(public.meg_normalize_text_core(p_name))
    else null
  end;
$body$;

create or replace function public.meg_compute_dedup_key(
  p_entity_type text,
  p_canonical_name text,
  p_canonical_email text default null,
  p_payload jsonb default '{}'::jsonb
)
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $body$
declare
  v_family text;
  v_hints jsonb;
  v_name text;
  v_email text;
begin
  v_family := public.meg_catalog_entity_family(p_entity_type);
  v_hints := coalesce(p_payload, '{}'::jsonb);
  if jsonb_typeof(v_hints) = 'object' and (v_hints ? 'hints') then
    v_hints := coalesce(v_hints->'hints', '{}'::jsonb);
  end if;
  v_name := coalesce(
    nullif(btrim(v_hints->>'display_name'), ''),
    nullif(btrim(p_canonical_name), ''),
    ''
  );
  v_email := coalesce(
    nullif(lower(btrim(p_canonical_email)), ''),
    nullif(lower(btrim(v_hints->>'email')), ''),
    nullif(lower(btrim(v_hints->>'canonical_email')), '')
  );

  if v_family = 'property' then
    return public.meg_normalize_property_dedup_key(
      v_name,
      v_hints->>'address',
      v_hints->>'city',
      v_hints->>'state'
    );
  elsif v_family = 'person' then
    return public.meg_normalize_person_dedup_key(v_name, v_email);
  elsif v_family = 'org' then
    return public.meg_normalize_org_dedup_key(v_name);
  end if;

  return null;
end;
$body$;

create index if not exists meg_entities_active_dedup_key_idx
  on public.meg_entities ((external_ids->>'meg_dedup_key'))
  where status = 'active'
    and coalesce(external_ids->>'meg_dedup_key', '') <> '';

create or replace function public.meg_resolve_or_create(
  p_entity_type text,
  p_canonical_name text,
  p_canonical_email text default null,
  p_canonical_external_id text default null,
  p_source_system text default null,
  p_source_table text default null,
  p_source_row_id text default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_meg_id uuid;
  v_existing uuid;
  v_email text;
  v_ext text;
  v_coarse public.meg_entity_type;
  v_name text;
  v_ext_ids jsonb;
  v_meta jsonb;
  v_lock_key text;
  v_dedup_key text;
  v_family text;
  v_match_count int;
begin
  if p_entity_type is null or btrim(p_entity_type) = '' then
    raise exception 'meg_resolve_or_create: p_entity_type required';
  end if;

  if length(p_entity_type) > 64 then
    raise exception 'meg_resolve_or_create: p_entity_type exceeds 64 chars';
  end if;
  if p_canonical_name is not null and length(p_canonical_name) > 500 then
    raise exception 'meg_resolve_or_create: p_canonical_name exceeds 500 chars';
  end if;
  if p_canonical_email is not null and length(p_canonical_email) > 320 then
    raise exception 'meg_resolve_or_create: p_canonical_email exceeds 320 chars';
  end if;
  if p_canonical_external_id is not null and length(p_canonical_external_id) > 256 then
    raise exception 'meg_resolve_or_create: p_canonical_external_id exceeds 256 chars';
  end if;
  if p_source_system is not null and length(p_source_system) > 64 then
    raise exception 'meg_resolve_or_create: p_source_system exceeds 64 chars';
  end if;
  if p_source_table is not null and length(p_source_table) > 96 then
    raise exception 'meg_resolve_or_create: p_source_table exceeds 96 chars';
  end if;
  if p_source_row_id is not null and length(p_source_row_id) > 256 then
    raise exception 'meg_resolve_or_create: p_source_row_id exceeds 256 chars';
  end if;
  if p_payload is not null and octet_length(p_payload::text) > 32768 then
    raise exception 'meg_resolve_or_create: p_payload exceeds 32 KiB';
  end if;

  v_name := coalesce(nullif(btrim(p_canonical_name), ''), '(unnamed)');
  v_email := case when p_canonical_email is not null then lower(btrim(p_canonical_email)) end;
  v_ext := case when p_canonical_external_id is not null then btrim(p_canonical_external_id) end;
  v_coarse := public.meg_catalog_to_meg_entity_type(p_entity_type);
  v_family := public.meg_catalog_entity_family(p_entity_type);
  v_dedup_key := public.meg_compute_dedup_key(p_entity_type, v_name, v_email, p_payload);

  v_ext_ids := jsonb_strip_nulls(jsonb_build_object(
    'primary_email', v_email,
    'canonical_external_id', v_ext,
    'meg_dedup_key', v_dedup_key
  ));
  v_meta := jsonb_strip_nulls(jsonb_build_object(
    'meg_catalog_entity_type', p_entity_type,
    'resolver', 'meg_resolve_or_create_v1',
    'meg_dedup_family', v_family
  ));

  v_lock_key := case
    when v_email is not null then 'em:' || v_email
    when v_dedup_key is not null then 'dk:' || v_dedup_key
    when v_ext is not null then 'ex:' || v_ext || ':' || coalesce(p_entity_type, '')
    else 'nm:' || md5(v_name || '|' || coalesce(p_entity_type, ''))
  end;
  perform pg_advisory_xact_lock(hashtext('meg_resolve_v1:' || v_lock_key));

  v_meg_id := null;

  if v_email is not null then
    select m.id into v_existing
    from public.meg_entities m
    where m.status = 'active'
      and (m.external_ids->>'primary_email') is not distinct from v_email
    limit 1;
    if v_existing is not null then
      v_meg_id := v_existing;
    end if;
  end if;

  if v_meg_id is null and v_dedup_key is not null then
    select count(*) into v_match_count
    from public.meg_entities m
    where m.status = 'active'
      and (m.external_ids->>'meg_dedup_key') = v_dedup_key
      and public.meg_catalog_entity_family(m.metadata->>'meg_catalog_entity_type') = v_family;

    if v_match_count > 1 then
      raise notice
        'meg_resolve_or_create: % active MEG rows share dedup key % (family %); picking oldest.',
        v_match_count, v_dedup_key, v_family;
    end if;

    select m.id into v_existing
    from public.meg_entities m
    where m.status = 'active'
      and (m.external_ids->>'meg_dedup_key') = v_dedup_key
      and public.meg_catalog_entity_family(m.metadata->>'meg_catalog_entity_type') = v_family
    order by m.created_at asc
    limit 1;

    if v_existing is not null then
      v_meg_id := v_existing;
    end if;
  end if;

  if v_meg_id is null and v_ext is not null then
    select m.id into v_existing
    from public.meg_entities m
    where m.status = 'active'
      and (m.external_ids->>'canonical_external_id') = v_ext
      and (m.metadata->>'meg_catalog_entity_type') is not distinct from p_entity_type
    limit 1;
    if v_existing is not null then
      v_meg_id := v_existing;
    end if;
  end if;

  if v_meg_id is not null then
    update public.meg_entities m
    set
      canonical_name = left(v_name, 500),
      external_ids = jsonb_strip_nulls(coalesce(m.external_ids, '{}'::jsonb) || coalesce(v_ext_ids, '{}'::jsonb)),
      metadata = jsonb_strip_nulls(coalesce(m.metadata, '{}'::jsonb) || coalesce(v_meta, '{}'::jsonb)),
      attributes = jsonb_strip_nulls(coalesce(m.attributes, '{}'::jsonb) || coalesce(p_payload, '{}'::jsonb)),
      updated_at = now()
    where m.id = v_meg_id;
  else
    insert into public.meg_entities (
      profile_id,
      entity_type,
      canonical_name,
      status,
      external_ids,
      metadata,
      attributes
    ) values (
      null,
      v_coarse,
      v_name,
      'active',
      coalesce(v_ext_ids, '{}'::jsonb),
      coalesce(v_meta, '{}'::jsonb),
      coalesce(p_payload, '{}'::jsonb)
    )
    returning id into v_meg_id;
  end if;

  if p_source_system is not null and p_source_table is not null and p_source_row_id is not null then
    insert into public.meg_entity_source_refs (
      meg_entity_id,
      source_system,
      source_table,
      source_row_id,
      resolved_at,
      resolver_version
    ) values (
      v_meg_id,
      p_source_system,
      p_source_table,
      p_source_row_id,
      now(),
      '1.0.0'
    )
    on conflict (source_system, source_table, source_row_id) do update set
      meg_entity_id = excluded.meg_entity_id,
      resolved_at = excluded.resolved_at,
      resolver_version = excluded.resolver_version;
  end if;

  return v_meg_id;
end;
$$;

-- Extend linkage RPC: optional location hints + works.entities merge by dedup key.
create or replace function public.ensure_source_entity_meg_linkage(
  p_source_system text,
  p_source_table text,
  p_source_row_id uuid,
  p_label text,
  p_works_kind text,
  p_meg_entity_id uuid default null,
  p_meg_catalog_entity_type text default 'meg:org',
  p_hints jsonb default '{}'::jsonb
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
  v_dedup_key text;
begin
  v_label := coalesce(nullif(trim(p_label), ''), 'Unnamed entity');
  v_kind := coalesce(nullif(trim(p_works_kind), ''), 'org');
  v_dedup_key := public.meg_compute_dedup_key(
    coalesce(nullif(trim(p_meg_catalog_entity_type), ''), 'meg:org'),
    v_label,
    null,
    p_hints
  );

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
      p_hints
    );
  end if;

  insert into public.meg_entity_source_refs (
    meg_entity_id, source_system, source_table, source_row_id,
    source_row_pk_type, resolver_version
  )
  values (
    v_meg_id, p_source_system, p_source_table, p_source_row_id::text,
    'uuid', 'ensure_source_entity_meg_linkage_v2'
  )
  on conflict (source_system, source_table, source_row_id) do update set
    meg_entity_id = excluded.meg_entity_id,
    resolved_at = now(),
    resolver_version = excluded.resolver_version;

  update public.meg_entities m
  set
    canonical_name = left(v_label, 500),
    updated_at = now(),
    external_ids = jsonb_strip_nulls(
      coalesce(m.external_ids, '{}'::jsonb) ||
      jsonb_build_object('meg_dedup_key', v_dedup_key)
    ),
    metadata = jsonb_strip_nulls(
      coalesce(m.metadata, '{}'::jsonb) ||
      jsonb_build_object(
        'linked_source_system', p_source_system,
        'linked_source_table', p_source_table,
        'linked_source_row_id', p_source_row_id::text
      )
    )
  where m.id = v_meg_id;

  select id into v_works_id
  from works.entities
  where meg_entity_id = v_meg_id
  limit 1;

  if v_works_id is null and v_dedup_key is not null then
    select id into v_works_id
    from works.entities
    where kind = v_kind
      and (metadata->>'meg_dedup_key') = v_dedup_key
    order by created_at asc
    limit 1;
  end if;

  if v_works_id is null then
    select id into v_works_id
    from works.entities
    where kind = v_kind
      and lower(label) = lower(v_label)
    order by created_at asc
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
          'meg_entity_id', v_meg_id::text,
          'meg_dedup_key', v_dedup_key
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
      jsonb_strip_nulls(jsonb_build_object(
        'synced_from', p_source_system || '.' || p_source_table,
        'source_row_id', p_source_row_id::text,
        'meg_entity_id', v_meg_id::text,
        'meg_dedup_key', v_dedup_key
      ))
    )
    returning id into v_works_id;
    perform set_config('app.entity_sync_in_progress', 'off', true);
  end if;

  return v_works_id;
end;
$$;

comment on function public.meg_compute_dedup_key(text, text, text, jsonb) is
  'Stable cross-source identity key (property address+city+state, org name, person email/name) for meg_resolve_or_create dedup.';

comment on function public.ensure_source_entity_meg_linkage(
  text, text, uuid, text, text, uuid, text, jsonb
) is
  'Idempotent MEG + works.entities wiring; merges works rows by meg_dedup_key when labels differ by formatting.';

revoke all on function public.ensure_source_entity_meg_linkage(
  text, text, uuid, text, text, uuid, text, jsonb
) from public;

grant execute on function public.ensure_source_entity_meg_linkage(
  text, text, uuid, text, text, uuid, text, jsonb
) to service_role;

commit;
