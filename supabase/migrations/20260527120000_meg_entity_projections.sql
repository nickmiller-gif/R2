-- Cross-site entity field propagation (R2-IP ↔ R2 Works).
-- Canonical projection store on Eigen MEG; applied via entity_field_update signals.

begin;

create table if not exists public.meg_entity_projections (
  meg_entity_id uuid primary key references public.meg_entities (id) on delete cascade,
  fields jsonb not null default '{}'::jsonb,
  last_source_revision text not null,
  last_event_time timestamptz not null,
  last_source_system text not null,
  last_source_signal_key text,
  updated_at timestamptz not null default now()
);

create index if not exists meg_entity_projections_updated_at_idx
  on public.meg_entity_projections (updated_at desc);

comment on table public.meg_entity_projections is
  'Canonical cross-product entity field snapshot; source of truth for KB-four client sync.';

create table if not exists public.meg_entity_projection_applies (
  id uuid primary key default gen_random_uuid(),
  meg_entity_id uuid not null references public.meg_entities (id) on delete cascade,
  source_revision text not null,
  source_system text not null,
  source_signal_key text,
  applied_at timestamptz not null default now(),
  unique (meg_entity_id, source_revision)
);

create index if not exists meg_entity_projection_applies_entity_idx
  on public.meg_entity_projection_applies (meg_entity_id, applied_at desc);

alter table public.meg_entity_projections enable row level security;
alter table public.meg_entity_projection_applies enable row level security;

create policy select_meg_entity_projections on public.meg_entity_projections
  for select to authenticated
  using (true);

create policy select_meg_entity_projection_applies on public.meg_entity_projection_applies
  for select to authenticated
  using (true);

-- Apply a field patch with revision ordering and idempotent replay protection.
create or replace function public.apply_meg_entity_projection_patch(
  p_meg_entity_id uuid,
  p_field_patch jsonb,
  p_source_revision text,
  p_event_time timestamptz,
  p_source_system text,
  p_source_signal_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
  v_merged jsonb;
  v_name text;
  v_dup boolean;
begin
  if p_meg_entity_id is null then
    return jsonb_build_object('applied', false, 'reason', 'missing_meg_entity_id');
  end if;

  if not exists (select 1 from public.meg_entities m where m.id = p_meg_entity_id and m.status = 'active') then
    return jsonb_build_object('applied', false, 'reason', 'meg_entity_not_found');
  end if;

  select exists (
    select 1
    from public.meg_entity_projection_applies a
    where a.meg_entity_id = p_meg_entity_id
      and a.source_revision = p_source_revision
  ) into v_dup;

  if v_dup then
    return jsonb_build_object('applied', false, 'reason', 'duplicate_revision');
  end if;

  select *
  into v_existing
  from public.meg_entity_projections p
  where p.meg_entity_id = p_meg_entity_id;

  if found and v_existing.last_event_time > p_event_time then
    return jsonb_build_object('applied', false, 'reason', 'stale_event_time');
  end if;

  v_merged := coalesce(v_existing.fields, '{}'::jsonb) || coalesce(p_field_patch, '{}'::jsonb);

  insert into public.meg_entity_projections (
    meg_entity_id,
    fields,
    last_source_revision,
    last_event_time,
    last_source_system,
    last_source_signal_key,
    updated_at
  ) values (
    p_meg_entity_id,
    v_merged,
    p_source_revision,
    p_event_time,
    p_source_system,
    p_source_signal_key,
    now()
  )
  on conflict (meg_entity_id) do update set
    fields = excluded.fields,
    last_source_revision = excluded.last_source_revision,
    last_event_time = excluded.last_event_time,
    last_source_system = excluded.last_source_system,
    last_source_signal_key = excluded.last_source_signal_key,
    updated_at = now();

  v_name := nullif(trim(both from coalesce(p_field_patch->>'name', '')), '');
  if v_name is not null then
    update public.meg_entities m
    set
      canonical_name = left(v_name, 500),
      attributes = jsonb_strip_nulls(coalesce(m.attributes, '{}'::jsonb) || p_field_patch),
      updated_at = now()
    where m.id = p_meg_entity_id;
  else
    update public.meg_entities m
    set
      attributes = jsonb_strip_nulls(coalesce(m.attributes, '{}'::jsonb) || p_field_patch),
      updated_at = now()
    where m.id = p_meg_entity_id;
  end if;

  insert into public.meg_entity_projection_applies (
    meg_entity_id,
    source_revision,
    source_system,
    source_signal_key
  ) values (
    p_meg_entity_id,
    p_source_revision,
    p_source_system,
    p_source_signal_key
  );

  return jsonb_build_object(
    'applied', true,
    'meg_entity_id', p_meg_entity_id,
    'fields', v_merged
  );
end;
$$;

grant execute on function public.apply_meg_entity_projection_patch(
  uuid, jsonb, text, timestamptz, text, text
) to service_role;

commit;
