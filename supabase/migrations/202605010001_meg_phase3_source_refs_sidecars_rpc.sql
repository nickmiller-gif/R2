-- Phase 3 MEG — source refs, backfill audit, sidecars, resolver + context RPCs.
-- Aligns with R2-MEG-Conversion-Runbook §2.1–2.6 while respecting existing schema:
--   * Canonical registry rows live in public.meg_entities (202604030010_meg_entities.sql).
--   * public.entities / public.entity_relations are separate legacy / Oracle-graph tables — not used here.

begin;

-- ── Catalog string → coarse meg_entity_type (enum cannot list every meg:catalog literal) ──
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
    else 'concept'::public.meg_entity_type
  end;
$$;

revoke all on function public.meg_catalog_to_meg_entity_type(text) from public;
grant execute on function public.meg_catalog_to_meg_entity_type(text) to authenticated, service_role;

-- ── 2.1c analogue: provenance back-references (one row per source row) ──
create table if not exists public.meg_entity_source_refs (
  id uuid primary key default gen_random_uuid(),
  meg_entity_id uuid not null references public.meg_entities (id) on delete cascade,
  source_system text not null,
  source_table text not null,
  source_row_id text not null,
  source_row_pk_type text not null default 'uuid',
  resolved_at timestamptz not null default now(),
  resolver_version text not null default '1.0.0',
  unique (source_system, source_table, source_row_id)
);

create index if not exists meg_entity_source_refs_entity_idx
  on public.meg_entity_source_refs (meg_entity_id);

alter table public.meg_entity_source_refs enable row level security;

drop policy if exists select_meg_entity_source_refs on public.meg_entity_source_refs;
create policy select_meg_entity_source_refs on public.meg_entity_source_refs
  for select to authenticated using (true);

drop policy if exists insert_meg_entity_source_refs on public.meg_entity_source_refs;
create policy insert_meg_entity_source_refs on public.meg_entity_source_refs
  for insert to service_role with check (true);

drop policy if exists delete_meg_entity_source_refs on public.meg_entity_source_refs;
create policy delete_meg_entity_source_refs on public.meg_entity_source_refs
  for delete to service_role using (true);

-- ── 2.1d backfill run audit ──
create table if not exists public.meg_backfill_runs (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_table text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  scanned int not null default 0,
  matched_existing int not null default 0,
  inserted_new int not null default 0,
  errors int not null default 0,
  dry_run boolean not null default false,
  notes text
);

alter table public.meg_backfill_runs enable row level security;

drop policy if exists select_meg_backfill_runs on public.meg_backfill_runs;
create policy select_meg_backfill_runs on public.meg_backfill_runs
  for select to authenticated
  using (
    exists (
      select 1 from public.charter_user_roles cur
      where cur.user_id = (select auth.uid())
        and cur.role::text in ('operator', 'counsel', 'admin')
    )
  );

drop policy if exists all_meg_backfill_runs_service on public.meg_backfill_runs;
create policy all_meg_backfill_runs_service on public.meg_backfill_runs
  for all to service_role using (true) with check (true);

-- ── Sidecars (FK → meg_entities) — runbook §2.2 ──
create table if not exists public.meg_person_attendee_sidecar (
  meg_entity_id uuid not null references public.meg_entities (id) on delete cascade,
  source_system text not null,
  retreat_attendee_id text,
  attendance_years int[],
  bio text,
  organization text,
  role text,
  linkedin_url text,
  email text,
  interests text[],
  is_speaker boolean not null default false,
  is_sponsor boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (meg_entity_id, source_system)
);

create table if not exists public.meg_person_contact_sidecar (
  meg_entity_id uuid primary key references public.meg_entities (id) on delete cascade,
  ci_master_contact_id uuid,
  ci_contact_ids uuid[],
  primary_email text,
  alternate_emails text[],
  primary_phone text,
  title text,
  company_meg_entity_id uuid references public.meg_entities (id),
  updated_at timestamptz not null default now()
);

create table if not exists public.meg_person_athlete_sidecar (
  meg_entity_id uuid primary key references public.meg_entities (id) on delete cascade,
  athlete_id uuid not null,
  sport text,
  conference text,
  school text,
  graduation_year int,
  nil_deal_count int,
  total_nil_value numeric,
  updated_at timestamptz not null default now()
);

create table if not exists public.meg_person_operator_sidecar (
  meg_entity_id uuid primary key references public.meg_entities (id) on delete cascade,
  operator_profile_id uuid not null,
  is_admin boolean not null default false,
  is_active boolean not null default true,
  scope_grants jsonb,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.meg_person_speaker_sidecar (
  meg_entity_id uuid primary key references public.meg_entities (id) on delete cascade,
  speaker_topics text[],
  events_spoken_at uuid[],
  bio text,
  updated_at timestamptz not null default now()
);

create table if not exists public.meg_company_sidecar (
  meg_entity_id uuid primary key references public.meg_entities (id) on delete cascade,
  ci_client_id uuid,
  legal_name text,
  domain text,
  industry text,
  size_band text,
  ein text,
  hq_city text,
  hq_state text,
  founded_year int,
  updated_at timestamptz not null default now()
);

create table if not exists public.meg_property_sidecar (
  meg_entity_id uuid primary key references public.meg_entities (id) on delete cascade,
  property_id uuid,
  parcel_id text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  county text,
  property_type text,
  acreage numeric,
  updated_at timestamptz not null default now()
);

create table if not exists public.meg_property_tower_sidecar (
  meg_entity_id uuid primary key references public.meg_entities (id) on delete cascade,
  tower_asset_id uuid,
  fcc_registration_id text,
  height_ft numeric,
  carriers_on_tower text[],
  ground_lease_status text,
  updated_at timestamptz not null default now()
);

create table if not exists public.meg_event_sidecar (
  meg_entity_id uuid primary key references public.meg_entities (id) on delete cascade,
  retreat_year int,
  start_date date,
  end_date date,
  location text,
  hero_image_url text,
  theme text,
  updated_at timestamptz not null default now()
);

create table if not exists public.meg_event_session_sidecar (
  meg_entity_id uuid primary key references public.meg_entities (id) on delete cascade,
  parent_event_id uuid references public.meg_entities (id),
  day_number int,
  start_time time,
  end_time time,
  title text,
  speaker_meg_entity_id uuid references public.meg_entities (id),
  session_type text,
  updated_at timestamptz not null default now()
);

create table if not exists public.meg_closing_file_sidecar (
  meg_entity_id uuid primary key references public.meg_entities (id) on delete cascade,
  seller_closing_file_id uuid,
  property_meg_entity_id uuid references public.meg_entities (id),
  scheduled_close_date date,
  status text,
  updated_at timestamptz not null default now()
);

create table if not exists public.meg_ip_matter_sidecar (
  meg_entity_id uuid primary key references public.meg_entities (id) on delete cascade,
  ip_matter_id uuid,
  matter_type text,
  uspto_application_no text,
  status text,
  participant_meg_ids uuid[],
  updated_at timestamptz not null default now()
);

create table if not exists public.meg_thesis_sidecar (
  meg_entity_id uuid primary key references public.meg_entities (id) on delete cascade,
  thesis_id uuid,
  domain text,
  confidence numeric(4, 3),
  publication_status text,
  updated_at timestamptz not null default now()
);

create table if not exists public.meg_opportunity_sidecar (
  meg_entity_id uuid primary key references public.meg_entities (id) on delete cascade,
  opportunity_id uuid,
  status text,
  economic_value_estimate numeric,
  updated_at timestamptz not null default now()
);

create table if not exists public.meg_document_sidecar (
  meg_entity_id uuid primary key references public.meg_entities (id) on delete cascade,
  document_uri text,
  source_system text,
  source_table text,
  source_row_id text,
  mime_type text,
  size_bytes bigint,
  retention_class text,
  updated_at timestamptz not null default now()
);

create table if not exists public.meg_topic_sidecar (
  meg_entity_id uuid primary key references public.meg_entities (id) on delete cascade,
  topic_label text,
  parent_topic_meg_entity_id uuid references public.meg_entities (id),
  embedding_vector_id uuid,
  updated_at timestamptz not null default now()
);

-- RLS: sidecars are operator-visible read; writes via service_role / SECURITY DEFINER RPCs
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
    execute format('alter table public.%I enable row level security;', r.tbl);
    execute format('drop policy if exists select_sidecar on public.%I;', r.tbl);
    execute format(
      'create policy select_sidecar on public.%I for select to authenticated using (true);',
      r.tbl
    );
    execute format('drop policy if exists write_sidecar_service on public.%I;', r.tbl);
    execute format(
      'create policy write_sidecar_service on public.%I for all to service_role using (true) with check (true);',
      r.tbl
    );
  end loop;
end $$;

-- ── Resolver: mint or match meg_entities + record meg_entity_source_refs ──
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
begin
  if p_entity_type is null or btrim(p_entity_type) = '' then
    raise exception 'meg_resolve_or_create: p_entity_type required';
  end if;

  v_name := coalesce(nullif(btrim(p_canonical_name), ''), '(unnamed)');
  v_email := case when p_canonical_email is not null then lower(btrim(p_canonical_email)) end;
  v_ext := case when p_canonical_external_id is not null then btrim(p_canonical_external_id) end;
  v_coarse := public.meg_catalog_to_meg_entity_type(p_entity_type);

  -- 1) email match (people-heavy)
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

  -- 2) external id + catalog type (scoped)
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

  if v_meg_id is null then
    v_ext_ids := jsonb_strip_nulls(jsonb_build_object(
      'primary_email', v_email,
      'canonical_external_id', v_ext
    ));
    v_meta := jsonb_strip_nulls(jsonb_build_object(
      'meg_catalog_entity_type', p_entity_type,
      'resolver', 'meg_resolve_or_create_v1'
    ));
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
      meg_entity_id, source_system, source_table, source_row_id
    ) values (
      v_meg_id, p_source_system, p_source_table, p_source_row_id
    )
    on conflict (source_system, source_table, source_row_id) do nothing;
  end if;

  return v_meg_id;
end;
$$;

revoke all on function public.meg_resolve_or_create(text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.meg_resolve_or_create(text, text, text, text, text, text, text, jsonb) to service_role;

-- ── Full context (meg_entities + source refs + meg_entity_edges, not Oracle entity_relations) ──
create or replace function public.meg_entity_full_context(p_meg_entity_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_entity jsonb;
  v_sources jsonb;
  v_edges jsonb;
begin
  select to_jsonb(m.*) into v_entity
  from public.meg_entities m
  where m.id = p_meg_entity_id;

  if v_entity is null then
    return jsonb_build_object('error', 'meg_entity_not_found');
  end if;

  select coalesce(jsonb_agg(to_jsonb(s.*)), '[]'::jsonb) into v_sources
  from public.meg_entity_source_refs s
  where s.meg_entity_id = p_meg_entity_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'edge_type', e.edge_type,
      'direction', case when e.source_entity_id = p_meg_entity_id then 'out' else 'in' end,
      'other_meg_entity_id',
        case when e.source_entity_id = p_meg_entity_id then e.target_entity_id else e.source_entity_id end,
      'confidence', e.confidence,
      'source', e.source,
      'metadata', e.metadata
  )), '[]'::jsonb) into v_edges
  from public.meg_entity_edges e
  where e.source_entity_id = p_meg_entity_id
     or e.target_entity_id = p_meg_entity_id;

  return jsonb_build_object(
    'meg_entity', v_entity,
    'source_refs', v_sources,
    'meg_entity_edges', v_edges
  );
end;
$$;

revoke all on function public.meg_entity_full_context(uuid) from public;
grant execute on function public.meg_entity_full_context(uuid) to service_role, authenticated;

-- ── Example sidecar upserts (runbook §2.6 pattern) ──
create or replace function public.meg_upsert_person_attendee_sidecar(
  p_entity_id uuid,
  p_source_system text,
  p_payload jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_years int[];
  v_interests text[];
begin
  select coalesce(array_agg(x::int), '{}'::int[]) into v_years
  from jsonb_array_elements_text(coalesce(p_payload->'attendance_years', '[]'::jsonb)) as t(x);

  select coalesce(array_agg(x), '{}'::text[]) into v_interests
  from jsonb_array_elements_text(coalesce(p_payload->'interests', '[]'::jsonb)) as t(x);

  insert into public.meg_person_attendee_sidecar (
    meg_entity_id, source_system, retreat_attendee_id,
    attendance_years, bio, organization, role,
    linkedin_url, email, interests, is_speaker, is_sponsor
  ) values (
    p_entity_id,
    p_source_system,
    p_payload->>'retreat_attendee_id',
    v_years,
    p_payload->>'bio',
    p_payload->>'organization',
    p_payload->>'role',
    p_payload->>'linkedin_url',
    lower(p_payload->>'email'),
    v_interests,
    coalesce((p_payload->>'is_speaker')::boolean, false),
    coalesce((p_payload->>'is_sponsor')::boolean, false)
  )
  on conflict (meg_entity_id, source_system) do update
    set retreat_attendee_id = excluded.retreat_attendee_id,
        attendance_years    = excluded.attendance_years,
        bio                 = excluded.bio,
        organization        = excluded.organization,
        role                = excluded.role,
        linkedin_url        = excluded.linkedin_url,
        email               = excluded.email,
        interests           = excluded.interests,
        is_speaker          = excluded.is_speaker,
        is_sponsor          = excluded.is_sponsor,
        updated_at          = now();
end;
$$;

revoke all on function public.meg_upsert_person_attendee_sidecar(uuid, text, jsonb) from public;
grant execute on function public.meg_upsert_person_attendee_sidecar(uuid, text, jsonb) to service_role;

create or replace function public.meg_upsert_thesis_sidecar(
  p_entity_id uuid,
  p_source_system text,
  p_payload jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.meg_thesis_sidecar (
    meg_entity_id, thesis_id, domain, confidence, publication_status
  ) values (
    p_entity_id,
    nullif(p_payload->>'thesis_id', '')::uuid,
    p_payload->>'domain',
    nullif(p_payload->>'confidence', '')::numeric(4, 3),
    p_payload->>'publication_status'
  )
  on conflict (meg_entity_id) do update
    set thesis_id = excluded.thesis_id,
        domain = excluded.domain,
        confidence = excluded.confidence,
        publication_status = excluded.publication_status,
        updated_at = now();
end;
$$;

revoke all on function public.meg_upsert_thesis_sidecar(uuid, text, jsonb) from public;
grant execute on function public.meg_upsert_thesis_sidecar(uuid, text, jsonb) to service_role;

commit;
