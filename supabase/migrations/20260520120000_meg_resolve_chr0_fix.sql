-- Fix meg_resolve_or_create on hosts where referencing chr(0) raises
-- "null character not permitted" (Supabase Postgres). Replaces any NUL-strip
-- prelude that used chr(0) and uses a pipe delimiter in the name-only lock key.

begin;

create or replace function public.meg_resolve_or_create(
  p_entity_type text,
  p_canonical_name text,
  p_canonical_email text default null,
  p_canonical_external_id text default null,
  p_source_system text default null,
  p_source_table text default null,
  p_source_row_id text default null,
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
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

  v_ext_ids := jsonb_strip_nulls(jsonb_build_object(
    'primary_email', v_email,
    'canonical_external_id', v_ext
  ));
  v_meta := jsonb_strip_nulls(jsonb_build_object(
    'meg_catalog_entity_type', p_entity_type,
    'resolver', 'meg_resolve_or_create_v1'
  ));

  -- Avoid chr(0): some Postgres builds reject NUL in SQL literals/expressions.
  v_lock_key := case
    when v_email is not null then 'em:' || v_email
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

commit;
