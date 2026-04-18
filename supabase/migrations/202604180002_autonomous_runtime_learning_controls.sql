create table if not exists public.autonomous_runtime_state (
  singleton boolean primary key default true,
  paused boolean not null default false,
  pause_reason text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into public.autonomous_runtime_state (singleton, paused)
values (true, false)
on conflict (singleton) do nothing;

create table if not exists public.autonomous_strategy_weights (
  strategy text primary key,
  weight numeric not null default 1.0,
  updated_at timestamptz not null default now()
);

create table if not exists public.autonomous_learning_outcomes (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  strategy text not null,
  expected_impact numeric not null,
  actual_impact numeric not null,
  error numeric not null,
  updated_weight numeric not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.autonomous_runtime_state enable row level security;
alter table public.autonomous_strategy_weights enable row level security;
alter table public.autonomous_learning_outcomes enable row level security;

drop policy if exists "runtime_state_member_read" on public.autonomous_runtime_state;
create policy "runtime_state_member_read"
on public.autonomous_runtime_state
for select
using (auth.role() = 'authenticated');

drop policy if exists "runtime_state_operator_write" on public.autonomous_runtime_state;
create policy "runtime_state_operator_write"
on public.autonomous_runtime_state
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "strategy_weights_member_read" on public.autonomous_strategy_weights;
create policy "strategy_weights_member_read"
on public.autonomous_strategy_weights
for select
using (auth.role() = 'authenticated');

drop policy if exists "strategy_weights_operator_write" on public.autonomous_strategy_weights;
create policy "strategy_weights_operator_write"
on public.autonomous_strategy_weights
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "learning_outcomes_member_read" on public.autonomous_learning_outcomes;
create policy "learning_outcomes_member_read"
on public.autonomous_learning_outcomes
for select
using (auth.role() = 'authenticated');

drop policy if exists "learning_outcomes_operator_write" on public.autonomous_learning_outcomes;
create policy "learning_outcomes_operator_write"
on public.autonomous_learning_outcomes
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');
