create table if not exists public.autonomous_captures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  page_title text,
  content_fingerprint text not null,
  raw_excerpt text not null,
  summary text,
  summary_model text,
  confidence_label text check (confidence_label in ('low','medium','high')),
  session_label text,
  oracle_run_id uuid,
  charter_decision_id uuid,
  ingest_status text not null default 'pending' check (ingest_status in ('pending','ingested','failed')),
  ingest_error text,
  ingested_document_id uuid,
  ingested_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_autonomous_captures_owner_created
  on public.autonomous_captures (owner_id, created_at desc);
create unique index if not exists idx_autonomous_captures_owner_fingerprint_unique
  on public.autonomous_captures (owner_id, content_fingerprint);
create index if not exists idx_autonomous_captures_ingest_status
  on public.autonomous_captures (ingest_status, created_at desc);

alter table public.autonomous_captures enable row level security;

create policy if not exists "autonomous_captures_select_own"
  on public.autonomous_captures
  for select
  using (auth.uid() = owner_id);

create policy if not exists "autonomous_captures_insert_own"
  on public.autonomous_captures
  for insert
  with check (auth.uid() = owner_id);

create policy if not exists "autonomous_captures_update_own"
  on public.autonomous_captures
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create or replace function public.autonomous_captures_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_autonomous_captures_updated_at on public.autonomous_captures;
create trigger trg_autonomous_captures_updated_at
before update on public.autonomous_captures
for each row execute function public.autonomous_captures_set_updated_at();
