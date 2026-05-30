-- meg_link_entities: skip edges whose endpoints do not exist in meg_entities.
--
-- KB-four producers (e.g. CentralR2 CRI rescore) can ship a related_entity_id
-- that was minted on a different project's MEG (Tower) and has no row in this
-- project's public.meg_entities. The affiliation edge insert then violates
-- meg_entity_edges_target_entity_id_fkey and deadletters the ENTIRE signal in
-- r2-signal-process (observed: 29 centralr2_cri_rescore rows failed 2026-05-28).
--
-- An affiliation edge to a non-existent node is impossible anyway (the FK
-- enforces it), so converting the hard FK error into a graceful skip is
-- behavior-preserving for valid edges and makes signal processing resilient to
-- dangling, producer-supplied cross-project ids.
CREATE OR REPLACE FUNCTION public.meg_link_entities(
  p_source_entity_id uuid,
  p_target_entity_id uuid,
  p_edge_type meg_edge_type,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if p_source_entity_id is null or p_target_entity_id is null then
    return;
  end if;
  if p_source_entity_id = p_target_entity_id then
    return;
  end if;

  -- Skip dangling references rather than raising a FK violation that would
  -- deadletter the whole feed row.
  if not exists (select 1 from public.meg_entities where id = p_source_entity_id)
     or not exists (select 1 from public.meg_entities where id = p_target_entity_id) then
    return;
  end if;

  insert into public.meg_entity_edges (
    source_entity_id,
    target_entity_id,
    edge_type,
    source,
    metadata
  ) values (
    p_source_entity_id,
    p_target_entity_id,
    p_edge_type,
    'r2_signal_process',
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (source_entity_id, target_entity_id, edge_type) do nothing;
end;
$function$;
