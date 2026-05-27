create table if not exists public.botos_page_captures (
  id text primary key,
  source_url text not null,
  host text not null,
  page_title text not null default '',
  raw_excerpt text not null default '',
  session_label text not null default 'default',
  ts timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_page_captures_host_ts on public.botos_page_captures (host, ts desc);
alter table public.botos_page_captures enable row level security;
drop policy if exists "botos_page_captures_select_anon" on public.botos_page_captures;
create policy "botos_page_captures_select_anon" on public.botos_page_captures for select to anon using (true);
drop policy if exists "botos_page_captures_select_auth" on public.botos_page_captures;
create policy "botos_page_captures_select_auth" on public.botos_page_captures for select to authenticated using (true);
drop policy if exists "botos_page_captures_all_service" on public.botos_page_captures;
create policy "botos_page_captures_all_service" on public.botos_page_captures for all to service_role using (true) with check (true);

create table if not exists public.botos_page_facts (
  id text primary key,
  source_url text not null,
  host text not null,
  kind text not null default 'domain',
  subject text not null default '',
  predicate text not null default '',
  value text not null default '',
  confidence real not null default 0.5,
  ts timestamptz not null default now()
);
create index if not exists idx_page_facts_host on public.botos_page_facts (host);
alter table public.botos_page_facts enable row level security;
drop policy if exists "botos_page_facts_select_anon" on public.botos_page_facts;
create policy "botos_page_facts_select_anon" on public.botos_page_facts for select to anon using (true);
drop policy if exists "botos_page_facts_select_auth" on public.botos_page_facts;
create policy "botos_page_facts_select_auth" on public.botos_page_facts for select to authenticated using (true);
drop policy if exists "botos_page_facts_all_service" on public.botos_page_facts;
create policy "botos_page_facts_all_service" on public.botos_page_facts for all to service_role using (true) with check (true);;
