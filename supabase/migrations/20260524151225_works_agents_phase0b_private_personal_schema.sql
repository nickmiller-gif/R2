create schema if not exists private_personal;

grant usage on schema private_personal to authenticated, service_role;

comment on schema private_personal is
  'Operator-private substrate for agent_finance. Per-row owner check enforced by RLS; no cross-operator visibility under any role except service_role (which re-asserts gates explicitly in edge functions).';

create table if not exists private_personal.finance_accounts (
  id                    uuid primary key default gen_random_uuid(),
  operator_user_id      uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  account_type          text not null
                        check (account_type in (
                          'checking', 'savings', 'brokerage',
                          'ira_traditional', 'ira_roth',
                          'k401', 'k401_roth',
                          'pension', 'hsa', 'other'
                        )),
  institution           text,
  account_external_id   text,
  currency              text not null default 'USD'
                        check (currency ~ '^[A-Z]{3}$'),
  is_taxable            boolean not null default true,
  is_retirement         boolean not null default false,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table private_personal.finance_accounts
  drop constraint if exists finance_accounts_id_operator_uniq;
alter table private_personal.finance_accounts
  add constraint finance_accounts_id_operator_uniq unique (id, operator_user_id);

create index if not exists finance_accounts_operator_idx
  on private_personal.finance_accounts (operator_user_id, account_type);
create index if not exists finance_accounts_retirement_idx
  on private_personal.finance_accounts (operator_user_id)
  where is_retirement = true;

drop trigger if exists finance_accounts_set_updated_at on private_personal.finance_accounts;
create trigger finance_accounts_set_updated_at
  before update on private_personal.finance_accounts
  for each row execute function works.set_updated_at();

create table if not exists private_personal.finance_holdings (
  id                    uuid primary key default gen_random_uuid(),
  operator_user_id      uuid not null references auth.users(id) on delete cascade,
  account_id            uuid not null,
  symbol                text,
  description           text,
  holding_type          text not null
                        check (holding_type in (
                          'stock', 'bond', 'mutual_fund', 'etf',
                          'cash', 'crypto', 'real_estate',
                          'private_equity', 'other'
                        )),
  quantity              numeric,
  cost_basis            numeric,
  market_value          numeric not null,
  as_of_date            date not null,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint finance_holdings_account_operator_fk
    foreign key (account_id, operator_user_id)
    references private_personal.finance_accounts (id, operator_user_id)
    on delete cascade
);

create index if not exists finance_holdings_operator_account_idx
  on private_personal.finance_holdings (operator_user_id, account_id, as_of_date desc);
create index if not exists finance_holdings_symbol_idx
  on private_personal.finance_holdings (operator_user_id, symbol)
  where symbol is not null;

drop trigger if exists finance_holdings_set_updated_at on private_personal.finance_holdings;
create trigger finance_holdings_set_updated_at
  before update on private_personal.finance_holdings
  for each row execute function works.set_updated_at();

create table if not exists private_personal.retirement_models (
  id                    uuid primary key default gen_random_uuid(),
  operator_user_id      uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  current_age           integer not null check (current_age between 0 and 120),
  target_retirement_age integer not null check (target_retirement_age between 0 and 120),
  annual_expenses       numeric not null check (annual_expenses >= 0),
  target_nest_egg       numeric,
  assumptions           jsonb not null default '{}'::jsonb,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint retirement_models_target_ge_current
    check (target_retirement_age >= current_age)
);

create index if not exists retirement_models_operator_idx
  on private_personal.retirement_models (operator_user_id, created_at desc);

drop trigger if exists retirement_models_set_updated_at on private_personal.retirement_models;
create trigger retirement_models_set_updated_at
  before update on private_personal.retirement_models
  for each row execute function works.set_updated_at();

alter table private_personal.finance_accounts enable row level security;
grant select on private_personal.finance_accounts to authenticated;
revoke insert, update, delete on private_personal.finance_accounts from authenticated;
grant select, insert, update, delete on private_personal.finance_accounts to service_role;

drop policy if exists finance_accounts_select on private_personal.finance_accounts;
create policy finance_accounts_select on private_personal.finance_accounts
  for select to authenticated
  using (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  );

drop policy if exists finance_accounts_insert on private_personal.finance_accounts;
create policy finance_accounts_insert on private_personal.finance_accounts
  for insert to authenticated
  with check (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  );

drop policy if exists finance_accounts_update on private_personal.finance_accounts;
create policy finance_accounts_update on private_personal.finance_accounts
  for update to authenticated
  using (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  )
  with check (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  );

drop policy if exists finance_accounts_delete on private_personal.finance_accounts;
create policy finance_accounts_delete on private_personal.finance_accounts
  for delete to authenticated
  using (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  );

alter table private_personal.finance_holdings enable row level security;
grant select on private_personal.finance_holdings to authenticated;
revoke insert, update, delete on private_personal.finance_holdings from authenticated;
grant select, insert, update, delete on private_personal.finance_holdings to service_role;

drop policy if exists finance_holdings_select on private_personal.finance_holdings;
create policy finance_holdings_select on private_personal.finance_holdings
  for select to authenticated
  using (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  );

drop policy if exists finance_holdings_insert on private_personal.finance_holdings;
create policy finance_holdings_insert on private_personal.finance_holdings
  for insert to authenticated
  with check (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
    and exists (
      select 1 from private_personal.finance_accounts a
      where a.id = account_id
        and a.operator_user_id = auth.uid()
    )
  );

drop policy if exists finance_holdings_update on private_personal.finance_holdings;
create policy finance_holdings_update on private_personal.finance_holdings
  for update to authenticated
  using (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  )
  with check (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  );

drop policy if exists finance_holdings_delete on private_personal.finance_holdings;
create policy finance_holdings_delete on private_personal.finance_holdings
  for delete to authenticated
  using (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  );

alter table private_personal.retirement_models enable row level security;
grant select on private_personal.retirement_models to authenticated;
revoke insert, update, delete on private_personal.retirement_models from authenticated;
grant select, insert, update, delete on private_personal.retirement_models to service_role;

drop policy if exists retirement_models_select on private_personal.retirement_models;
create policy retirement_models_select on private_personal.retirement_models
  for select to authenticated
  using (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  );

drop policy if exists retirement_models_insert on private_personal.retirement_models;
create policy retirement_models_insert on private_personal.retirement_models
  for insert to authenticated
  with check (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  );

drop policy if exists retirement_models_update on private_personal.retirement_models;
create policy retirement_models_update on private_personal.retirement_models
  for update to authenticated
  using (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  )
  with check (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  );

drop policy if exists retirement_models_delete on private_personal.retirement_models;
create policy retirement_models_delete on private_personal.retirement_models
  for delete to authenticated
  using (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  );

comment on table private_personal.finance_accounts is
  'Operator-private list of bank / brokerage / retirement accounts. Visible only to the owning operator under RLS.';
comment on table private_personal.finance_holdings is
  'Operator-private current positions per account. Snapshot model — write the latest market_value with the as_of_date; historical positions live in a future finance_holdings_history if needed. Cross-row owner integrity enforced by a composite FK on (account_id, operator_user_id).';
comment on table private_personal.retirement_models is
  'Operator-defined retirement scenarios that agent_finance reasons against. assumptions JSONB is the open-ended bag of dials (real_return_rate, inflation_rate, withdrawal_rate, etc.) so new assumptions don''t require schema changes.';;
