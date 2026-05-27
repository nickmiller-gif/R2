create or replace function public.has_operator_plan_review_access(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, works
as $$
  select
    public.is_active_operator(_user_id)
    or public.is_works_admin(_user_id)
    or exists (
      select 1
      from public.charter_user_roles cur
      where cur.user_id = _user_id
        and cur.role in ('operator', 'counsel', 'admin')
    );
$$;

create table if not exists public.operator_idea_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body_md text not null,
  domain text not null,
  sensitivity text not null default 'operator_private',
  advisor_review_required boolean not null default false,
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint operator_idea_entries_domain_chk check (domain in ('central_tax_strategy','r2_community','rays_retreat','asset_planning','other')),
  constraint operator_idea_entries_status_chk check (status in ('draft','active','researching','advisor_review','parked','archived')),
  constraint operator_idea_entries_sensitivity_chk check (sensitivity in ('operator_private','advisor_sensitive','public_candidate'))
);
create index if not exists operator_idea_entries_domain_idx on public.operator_idea_entries (domain);
create index if not exists operator_idea_entries_status_idx on public.operator_idea_entries (status);
create index if not exists operator_idea_entries_advisor_required_idx on public.operator_idea_entries (advisor_review_required);
create index if not exists operator_idea_entries_created_at_desc_idx on public.operator_idea_entries (created_at desc);

drop trigger if exists trg_operator_idea_entries_updated on public.operator_idea_entries;
create trigger trg_operator_idea_entries_updated
before update on public.operator_idea_entries
for each row execute function works.set_updated_at();

alter table public.operator_idea_entries enable row level security;
grant select, insert, update, delete on public.operator_idea_entries to authenticated;
drop policy if exists operator_idea_entries_select on public.operator_idea_entries;
create policy operator_idea_entries_select on public.operator_idea_entries
for select to authenticated
using (public.has_operator_plan_review_access(auth.uid()));
drop policy if exists operator_idea_entries_insert on public.operator_idea_entries;
create policy operator_idea_entries_insert on public.operator_idea_entries
for insert to authenticated
with check (public.has_operator_plan_review_access(auth.uid()));
drop policy if exists operator_idea_entries_update on public.operator_idea_entries;
create policy operator_idea_entries_update on public.operator_idea_entries
for update to authenticated
using (public.has_operator_plan_review_access(auth.uid()))
with check (public.has_operator_plan_review_access(auth.uid()));
drop policy if exists operator_idea_entries_delete on public.operator_idea_entries;
create policy operator_idea_entries_delete on public.operator_idea_entries
for delete to authenticated
using (public.has_operator_plan_review_access(auth.uid()));

create table if not exists public.operator_research_runs (
  id uuid primary key default gen_random_uuid(),
  idea_entry_id uuid not null references public.operator_idea_entries(id) on delete cascade,
  research_type text not null,
  query text not null,
  status text not null default 'pending',
  model_set jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
create table if not exists public.operator_research_sources (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid not null references public.operator_research_runs(id) on delete cascade,
  source_title text,
  source_url text,
  source_type text,
  publisher text,
  published_at timestamptz,
  excerpt text,
  metadata jsonb not null default '{}'::jsonb
);
create table if not exists public.operator_research_claims (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid not null references public.operator_research_runs(id) on delete cascade,
  claim text not null,
  confidence text,
  source_ids uuid[] not null default '{}'::uuid[],
  needs_advisor_review boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);
create table if not exists public.operator_research_syntheses (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid not null references public.operator_research_runs(id) on delete cascade,
  summary_md text not null,
  consensus_points jsonb not null default '[]'::jsonb,
  disagreements jsonb not null default '[]'::jsonb,
  open_questions jsonb not null default '[]'::jsonb,
  recommended_next_steps jsonb not null default '[]'::jsonb,
  eigenx_ready boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  unique (research_run_id)
);
create index if not exists operator_research_runs_idea_idx on public.operator_research_runs (idea_entry_id, started_at desc);
create index if not exists operator_research_runs_status_idx on public.operator_research_runs (status);
create index if not exists operator_research_sources_run_idx on public.operator_research_sources (research_run_id);
create index if not exists operator_research_claims_run_idx on public.operator_research_claims (research_run_id);
create index if not exists operator_research_claims_advisor_idx on public.operator_research_claims (needs_advisor_review);
create index if not exists operator_research_syntheses_run_idx on public.operator_research_syntheses (research_run_id);

alter table public.operator_research_runs enable row level security;
alter table public.operator_research_sources enable row level security;
alter table public.operator_research_claims enable row level security;
alter table public.operator_research_syntheses enable row level security;
grant select, insert, update, delete on public.operator_research_runs to authenticated;
grant select, insert, update, delete on public.operator_research_sources to authenticated;
grant select, insert, update, delete on public.operator_research_claims to authenticated;
grant select, insert, update, delete on public.operator_research_syntheses to authenticated;

drop policy if exists operator_research_runs_select on public.operator_research_runs;
create policy operator_research_runs_select on public.operator_research_runs for select to authenticated using (public.has_operator_plan_review_access(auth.uid()));
drop policy if exists operator_research_runs_insert on public.operator_research_runs;
create policy operator_research_runs_insert on public.operator_research_runs for insert to authenticated with check (public.has_operator_plan_review_access(auth.uid()));
drop policy if exists operator_research_runs_update on public.operator_research_runs;
create policy operator_research_runs_update on public.operator_research_runs for update to authenticated using (public.has_operator_plan_review_access(auth.uid())) with check (public.has_operator_plan_review_access(auth.uid()));
drop policy if exists operator_research_runs_delete on public.operator_research_runs;
create policy operator_research_runs_delete on public.operator_research_runs for delete to authenticated using (public.has_operator_plan_review_access(auth.uid()));

drop policy if exists operator_research_sources_select on public.operator_research_sources;
create policy operator_research_sources_select on public.operator_research_sources for select to authenticated using (public.has_operator_plan_review_access(auth.uid()));
drop policy if exists operator_research_sources_insert on public.operator_research_sources;
create policy operator_research_sources_insert on public.operator_research_sources for insert to authenticated with check (public.has_operator_plan_review_access(auth.uid()));
drop policy if exists operator_research_sources_update on public.operator_research_sources;
create policy operator_research_sources_update on public.operator_research_sources for update to authenticated using (public.has_operator_plan_review_access(auth.uid())) with check (public.has_operator_plan_review_access(auth.uid()));
drop policy if exists operator_research_sources_delete on public.operator_research_sources;
create policy operator_research_sources_delete on public.operator_research_sources for delete to authenticated using (public.has_operator_plan_review_access(auth.uid()));

drop policy if exists operator_research_claims_select on public.operator_research_claims;
create policy operator_research_claims_select on public.operator_research_claims for select to authenticated using (public.has_operator_plan_review_access(auth.uid()));
drop policy if exists operator_research_claims_insert on public.operator_research_claims;
create policy operator_research_claims_insert on public.operator_research_claims for insert to authenticated with check (public.has_operator_plan_review_access(auth.uid()));
drop policy if exists operator_research_claims_update on public.operator_research_claims;
create policy operator_research_claims_update on public.operator_research_claims for update to authenticated using (public.has_operator_plan_review_access(auth.uid())) with check (public.has_operator_plan_review_access(auth.uid()));
drop policy if exists operator_research_claims_delete on public.operator_research_claims;
create policy operator_research_claims_delete on public.operator_research_claims for delete to authenticated using (public.has_operator_plan_review_access(auth.uid()));

drop policy if exists operator_research_syntheses_select on public.operator_research_syntheses;
create policy operator_research_syntheses_select on public.operator_research_syntheses for select to authenticated using (public.has_operator_plan_review_access(auth.uid()));
drop policy if exists operator_research_syntheses_insert on public.operator_research_syntheses;
create policy operator_research_syntheses_insert on public.operator_research_syntheses for insert to authenticated with check (public.has_operator_plan_review_access(auth.uid()));
drop policy if exists operator_research_syntheses_update on public.operator_research_syntheses;
create policy operator_research_syntheses_update on public.operator_research_syntheses for update to authenticated using (public.has_operator_plan_review_access(auth.uid())) with check (public.has_operator_plan_review_access(auth.uid()));
drop policy if exists operator_research_syntheses_delete on public.operator_research_syntheses;
create policy operator_research_syntheses_delete on public.operator_research_syntheses for delete to authenticated using (public.has_operator_plan_review_access(auth.uid()));;
