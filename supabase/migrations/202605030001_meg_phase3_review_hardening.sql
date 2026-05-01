-- PR #205 review hardening: least-privilege RLS, resolver concurrency, edge idempotency,
-- catalog gaps, lookup indexes, and source-ref upsert semantics.

begin;

-- ── Catalog: map IP vocabulary to coarse `ip` enum (202604080012) ──
create or replace function public.meg_catalog_to_meg_entity_type(p_catalog text)
returns public.meg_entity_type
language sql
immutable
as $$
  select case
    when p_catalog ilike 'meg:person%' then 'person'::public.meg_entity_type
    when p_catalog ilike 'meg:company%' then 'org'::public.meg_entity_type
    when p_catalog ilike 'meg:property%' or p_catalog = 'meg:closing_file' then 'property'::public.meg_entity_type
    when p_catalog ilike 'meg:event%' then 'concept'::public.meg_entity_type
    when p_catalog ilike 'meg:ip_matter%' or p_catalog ilike 'meg:patent%' then 'ip'::public.meg_entity_type
    else 'concept'::public.meg_entity_type
  end;
$$;

-- ── Source refs: non-UUID composite keys (e.g. feed + synthetic segment ids) ──
alter table public.meg_entity_source_refs
  alter column source_row_pk_type set default 'text';

-- ── meg_entity_edges: dedupe then unique triple for concurrent-safe linking ──
delete from public.meg_entity_edges a
using public.meg_entity_edges b
where a.source_entity_id = b.source_entity_id
  and a.target_entity_id = b.target_entity_id
  and a.edge_type = b.edge_type
  and a.id > b.id;

create unique index if not exists meg_entity_edges_source_target_type_uniq
  on public.meg_entity_edges (source_entity_id, target_entity_id, edge_type);

create or replace function public.meg_link_entities(
  p_source_entity_id uuid,
  p_target_entity_id uuid,
  p_edge_type public.meg_edge_type,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_source_entity_id is null or p_target_entity_id is null then
    return;
  end if;
  if p_source_entity_id = p_target_entity_id then
    return;
  end if;

  insert into public.meg_entity_edges (
    source_entity_id,
    target_entity_id,
    edge_type,
    source,
    metadata
  ) values (
    p_source_entity_id,
    p_target_entity_id,
    p_edge_type,
    'r2_signal_process',
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (source_entity_id, target_entity_id, edge_type) do nothing;
end;
$$;

-- ── Resolver hot-path indexes (btree on expressions; partial active rows) ──
create index if not exists idx_meg_entities_primary_email_active
  on public.meg_entities (lower((external_ids->>'primary_email')))
  where status = 'active'
    and (external_ids->>'primary_email') is not null
    and btrim(external_ids->>'primary_email') <> '';

create index if not exists idx_meg_entities_canonical_ext_catalog_active
  on public.meg_entities (
    (external_ids->>'canonical_external_id'),
    (metadata->>'meg_catalog_entity_type')
  )
  where status = 'active'
    and (external_ids->>'canonical_external_id') is not null
    and btrim(external_ids->>'canonical_external_id') <> '';

-- ── meg_resolve_or_create: advisory lock + merge-on-match + source-ref refresh ──
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

  v_lock_key := case
    when v_email is not null then 'em:' || v_email
    when v_ext is not null then 'ex:' || v_ext || ':' || coalesce(p_entity_type, '')
    else 'nm:' || md5(v_name || chr(0) || coalesce(p_entity_type, ''))
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

-- ── RLS: provenance + sidecars — operator/counsel/admin only (match meg_backfill_runs) ──
drop policy if exists select_meg_entity_source_refs on public.meg_entity_source_refs;
create policy select_meg_entity_source_refs on public.meg_entity_source_refs
  for select to authenticated
  using (
    exists (
      select 1 from public.charter_user_roles cur
      where cur.user_id = (select auth.uid())
        and cur.role::text in ('operator', 'counsel', 'admin')
    )
  );

do $$
declare
  r record;
begin
  for r in
    select c.relname as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname in (
        'meg_person_attendee_sidecar',
        'meg_person_contact_sidecar',
        'meg_person_athlete_sidecar',
        'meg_person_operator_sidecar',
        'meg_person_speaker_sidecar',
        'meg_company_sidecar',
        'meg_property_sidecar',
        'meg_property_tower_sidecar',
        'meg_event_sidecar',
        'meg_event_session_sidecar',
        'meg_closing_file_sidecar',
        'meg_ip_matter_sidecar',
        'meg_thesis_sidecar',
        'meg_opportunity_sidecar',
        'meg_document_sidecar',
        'meg_topic_sidecar'
      )
  loop
    execute format('drop policy if exists select_sidecar on public.%I;', r.tbl);
    execute format(
      $exec$
      create policy select_sidecar on public.%I for select to authenticated using (
        exists (
          select 1 from public.charter_user_roles cur
          where cur.user_id = (select auth.uid())
            and cur.role::text in ('operator', 'counsel', 'admin')
        )
      );
      $exec$,
      r.tbl
    );
  end loop;
end $$;

commit;
