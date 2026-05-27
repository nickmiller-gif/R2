create or replace function public.bump_agent_run_totals(
  p_run_id uuid,
  p_tokens integer default 0,
  p_cost_usd numeric default 0
) returns void
language sql
security definer
set search_path = public
as $$
  update public.agent_runs
  set
    total_tokens = coalesce(total_tokens, 0) + coalesce(p_tokens, 0),
    total_cost_usd = coalesce(total_cost_usd, 0) + coalesce(p_cost_usd, 0)
  where id = p_run_id;
$$;

revoke all on function public.bump_agent_run_totals(uuid, integer, numeric) from public, anon, authenticated;
grant execute on function public.bump_agent_run_totals(uuid, integer, numeric) to service_role;;
