create or replace function private_personal.latest_finance_holdings(p_operator_user_id uuid)
returns table (
  id              uuid,
  account_id      uuid,
  symbol          text,
  description     text,
  holding_type    text,
  quantity        numeric,
  cost_basis      numeric,
  market_value    numeric,
  as_of_date      date
)
language sql
stable
security invoker
set search_path = private_personal, pg_temp
as $body$
  select distinct on (
    h.account_id,
    coalesce(
      h.symbol,
      '__nosym::' || h.holding_type || '::' || coalesce(h.description, '')
    )
  )
    h.id,
    h.account_id,
    h.symbol,
    h.description,
    h.holding_type,
    h.quantity,
    h.cost_basis,
    h.market_value,
    h.as_of_date
  from private_personal.finance_holdings h
  where h.operator_user_id = p_operator_user_id
  order by
    h.account_id,
    coalesce(
      h.symbol,
      '__nosym::' || h.holding_type || '::' || coalesce(h.description, '')
    ),
    h.as_of_date desc,
    h.id
$body$;

grant execute on function private_personal.latest_finance_holdings(uuid)
  to authenticated, service_role;

comment on function private_personal.latest_finance_holdings(uuid) is
  'Phase 3: returns one row per logical position (account, symbol or synthetic key for null-symbol cash/real-estate/PE positions), choosing the snapshot with the freshest as_of_date. Used by agent_finance to compute the current balance sheet without the TS-side reducer''s null-symbol + limit-truncation gaps.';;
