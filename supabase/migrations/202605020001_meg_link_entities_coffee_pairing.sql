-- Idempotent edge helper + coffee_pairing enum literal for signal-derived MEG links.

alter type public.meg_edge_type add value if not exists 'coffee_pairing';

create or replace function public.meg_link_entities(
  p_source_entity_id uuid,
  p_target_entity_id uuid,
  p_edge_type public.meg_edge_type,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_source_entity_id is null or p_target_entity_id is null then
    return;
  end if;
  if p_source_entity_id = p_target_entity_id then
    return;
  end if;

  insert into public.meg_entity_edges (
    source_entity_id,
    target_entity_id,
    edge_type,
    source,
    metadata
  )
  select
    p_source_entity_id,
    p_target_entity_id,
    p_edge_type,
    'r2_signal_process',
    coalesce(p_metadata, '{}'::jsonb)
  where not exists (
    select 1
    from public.meg_entity_edges e
    where e.source_entity_id = p_source_entity_id
      and e.target_entity_id = p_target_entity_id
      and e.edge_type = p_edge_type
  );
end;
$$;

revoke all on function public.meg_link_entities(uuid, uuid, public.meg_edge_type, jsonb) from public;
grant execute on function public.meg_link_entities(uuid, uuid, public.meg_edge_type, jsonb) to service_role;
