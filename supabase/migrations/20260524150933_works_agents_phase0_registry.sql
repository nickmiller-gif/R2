create table if not exists works.agents (
  slug             text primary key,
  name             text not null,
  tagline          text,
  description      text,
  status           text not null default 'coming_soon'
                   check (status in ('active','coming_soon','disabled')),
  trigger_kind     text not null default 'on_demand'
                   check (trigger_kind in ('on_demand','on_event','cron')),
  enabled          boolean not null default false,
  governance_scope text not null default 'commercial'
                   check (governance_scope in ('foundation','commercial','both','private_personal')),
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists agents_status_enabled_idx
  on works.agents (status, enabled);

create table if not exists works.agent_runs (
  id                 uuid primary key default gen_random_uuid(),
  agent_slug         text not null references works.agents(slug) on delete cascade,
  operator_user_id   uuid references auth.users(id) on delete set null,
  status             text not null default 'pending'
                     check (status in ('pending','running','succeeded','failed','cancelled')),
  trigger_source     text not null default 'on_demand'
                     check (trigger_source in ('on_demand','event','cron','replay')),
  input_payload      jsonb not null default '{}'::jsonb,
  error              text,
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  latency_ms         integer,
  governance_scope   text not null default 'commercial'
                     check (governance_scope in ('foundation','commercial','both','private_personal'))
);

create index if not exists agent_runs_agent_slug_started_at_idx
  on works.agent_runs (agent_slug, started_at desc);
create index if not exists agent_runs_operator_user_id_idx
  on works.agent_runs (operator_user_id, started_at desc);
create index if not exists agent_runs_status_idx
  on works.agent_runs (status, started_at desc);

create table if not exists works.agent_run_outputs (
  id                 uuid primary key default gen_random_uuid(),
  run_id             uuid not null references works.agent_runs(id) on delete cascade,
  section            text not null,
  content_markdown   text,
  content_json       jsonb,
  artifact_key       text,
  artifact_format    text,
  artifact_file_path text,
  created_at         timestamptz not null default now()
);

create index if not exists agent_run_outputs_run_id_idx
  on works.agent_run_outputs (run_id, created_at);

alter table works.agents enable row level security;
grant select, insert, update, delete on works.agents to authenticated;

drop trigger if exists agents_set_updated_at on works.agents;
create trigger agents_set_updated_at
  before update on works.agents
  for each row execute function works.set_updated_at();

drop policy if exists agents_select on works.agents;
create policy agents_select on works.agents
  for select to authenticated
  using (public.is_active_operator(auth.uid()));

drop policy if exists agents_insert on works.agents;
create policy agents_insert on works.agents
  for insert to authenticated
  with check (public.is_works_admin(auth.uid()));

drop policy if exists agents_update on works.agents;
create policy agents_update on works.agents
  for update to authenticated
  using (public.is_works_admin(auth.uid()))
  with check (public.is_works_admin(auth.uid()));

drop policy if exists agents_delete on works.agents;
create policy agents_delete on works.agents
  for delete to authenticated
  using (public.is_works_admin(auth.uid()));

alter table works.agent_runs enable row level security;
grant select, insert, update on works.agent_runs to authenticated;

drop policy if exists agent_runs_select on works.agent_runs;
create policy agent_runs_select on works.agent_runs
  for select to authenticated
  using (
    public.is_active_operator(auth.uid())
    and (
      operator_user_id = auth.uid()
      or (
        operator_user_id is null
        and works.operator_allows_scope(auth.uid(), governance_scope)
        and governance_scope <> 'private_personal'
      )
    )
  );

drop policy if exists agent_runs_insert on works.agent_runs;
create policy agent_runs_insert on works.agent_runs
  for insert to authenticated
  with check (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
    and works.operator_allows_scope(auth.uid(), governance_scope)
  );

drop policy if exists agent_runs_update on works.agent_runs;
create policy agent_runs_update on works.agent_runs
  for update to authenticated
  using (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
    and works.operator_allows_scope(auth.uid(), governance_scope)
  )
  with check (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
    and works.operator_allows_scope(auth.uid(), governance_scope)
  );

alter table works.agent_run_outputs enable row level security;
grant select on works.agent_run_outputs to authenticated;
grant insert, update, delete on works.agent_run_outputs to service_role;

drop policy if exists agent_run_outputs_select on works.agent_run_outputs;
create policy agent_run_outputs_select on works.agent_run_outputs
  for select to authenticated
  using (
    exists (
      select 1
      from works.agent_runs r
      where r.id = run_id
        and public.is_active_operator(auth.uid())
        and (
          r.operator_user_id = auth.uid()
          or (
            r.operator_user_id is null
            and works.operator_allows_scope(auth.uid(), r.governance_scope)
            and r.governance_scope <> 'private_personal'
          )
        )
    )
  );

insert into works.agents (slug, name, tagline, description, status, trigger_kind, governance_scope, sort_order)
values
  (
    'agent_time',
    'Time-tracking Copilot',
    'Drafts billable time entries from your calendar and email.',
    'Watches yesterday''s calendar events and email exchanges, groups by client/matter against MEG entities, and proposes time entries with narratives. Operator approves or edits before export to billing.',
    'coming_soon',
    'cron',
    'commercial',
    10
  ),
  (
    'agent_bd',
    'Client Development',
    'Spots opportunities from ecosystem signals.',
    'Cross-references new platform_feed_items against your active clients and tracked topics, then suggests relevant outreach. Promotes to /white-space dossiers via the existing operator-gated flow.',
    'coming_soon',
    'on_event',
    'commercial',
    20
  ),
  (
    'agent_relationship',
    'Stay-In-Touch Network',
    'Keeps your network warm and suggests warm intros.',
    'Tracks last-touch with MEG person entities via calendar+email ingest. Flags contacts going cold; proposes warm introductions when role/company signals land.',
    'coming_soon',
    'cron',
    'commercial',
    30
  ),
  (
    'agent_finance',
    'Personal Finance & Retirement Strategy',
    'Confidential — your finances only.',
    'Reads from the separate private schema (set up in a follow-up migration). Models retirement timing, Roth conversion windows, working-vs-retiring break-even. Output never leaves the private surface.',
    'coming_soon',
    'cron',
    'private_personal',
    40
  )
on conflict (slug) do nothing;;
