create or replace function public.ow_fetch_unified_graph(
  p_entity_limit integer default 350,
  p_edge_limit integer default 2000,
  p_meg_node_limit integer default 400,
  p_asset_limit integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public, works
as $body$
declare
  v_works_nodes jsonb;
  v_works_edges jsonb;
  v_meg_nodes jsonb := '[]'::jsonb;
  v_meg_edges jsonb := '[]'::jsonb;
  v_asset_nodes jsonb := '[]'::jsonb;
  v_asset_edges jsonb := '[]'::jsonb;
  v_sql text;
  v_has_meg boolean;
  v_has_assets boolean;
  v_interesting_edge_types text := $elist$('owns', 'subsidiary_of', 'employs', 'located_at', 'related_to', 'member_of', 'affiliated_with', 'controls', 'manages', 'advisor_to', 'investor_in', 'counterparty_to')$elist$;
begin
  if auth.uid() is null or not public.is_active_operator(auth.uid()) then
    raise exception 'not authorized';
  end if;

  if p_entity_limit is null or p_entity_limit < 10 then
    p_entity_limit := 10;
  elsif p_entity_limit > 2000 then
    p_entity_limit := 2000;
  end if;

  if p_edge_limit is null or p_edge_limit < 50 then
    p_edge_limit := 50;
  elsif p_edge_limit > 8000 then
    p_edge_limit := 8000;
  end if;

  select coalesce(jsonb_agg(j ORDER BY ord), '[]'::jsonb)
    into v_works_nodes
  from (
    select
      row_number() over (order by e.created_at desc) as ord,
      jsonb_build_object(
        'id', e.id::text,
        'name', e.label,
        'kind', e.kind,
        'governance_scope', coalesce(nullif(e.metadata ->> 'governance_scope', ''), 'both'),
        'source', 'works',
        'meg_entity_id', nullif(e.metadata ->> 'meg_entity_id', ''),
        'client_id', nullif(e.metadata ->> 'client_id', '')
      ) as j
    from works.entities e
    order by e.created_at desc
    limit p_entity_limit
  ) wn;

  select coalesce(jsonb_agg(j ORDER BY ord), '[]'::jsonb)
    into v_works_edges
  from (
    select
      row_number() over (order by ee.id) as ord,
      jsonb_build_object(
        'id', ee.id::text,
        'source', ee.src_entity_id::text,
        'target', ee.dst_entity_id::text,
        'label', ee.kind,
        'provenance', 'works'
      ) as j
    from works.entity_edges ee
    where exists (
        select 1
        from (
          select e.id
          from works.entities e
          order by e.created_at desc
          limit p_entity_limit
        ) w
        where w.id = ee.src_entity_id
      )
      and exists (
        select 1
        from (
          select e.id
          from works.entities e
          order by e.created_at desc
          limit p_entity_limit
        ) w2
        where w2.id = ee.dst_entity_id
      )
    order by ee.id
    limit p_edge_limit
  ) we;

  v_has_meg := to_regclass('public.meg_entities') is not null
    and to_regclass('public.meg_entity_edges') is not null;

  if v_has_meg then
    v_sql := format(
      $q$
      select coalesce(jsonb_agg(j ORDER BY ord), '[]'::jsonb)
      from (
        select
          row_number() over (order by m.updated_at desc) as ord,
          jsonb_build_object(
            'id', 'm:' || m.id::text,
            'name', m.canonical_name,
            'kind',
              case m.entity_type::text
                when 'person' then 'person'
                when 'org' then 'organization'
                when 'property' then 'property'
                when 'product' then 'brand'
                when 'location' then 'site'
                else 'unknown'
              end,
            'governance_scope', coalesce(nullif(m.metadata ->> 'governance_scope', ''), 'both'),
            'source', 'meg',
            'meg_entity_id', m.id::text,
            'client_id', null
          ) as j
        from public.meg_entities m
        where m.status::text = 'active'
          and m.id in (
            select e.source_entity_id
            from public.meg_entity_edges e
            where e.edge_type::text in %s
            union
            select e.target_entity_id
            from public.meg_entity_edges e
            where e.edge_type::text in %s
          )
        order by m.updated_at desc
        limit %s
      ) q
      $q$,
      v_interesting_edge_types,
      v_interesting_edge_types,
      p_meg_node_limit
    );
    execute v_sql into v_meg_nodes;

    v_sql := format(
      $q$
      select coalesce(jsonb_agg(j ORDER BY ord), '[]'::jsonb)
      from (
        select
          row_number() over (order by e.id) as ord,
          jsonb_build_object(
            'id', 'meg:' || e.id::text,
            'source', 'm:' || e.source_entity_id::text,
            'target', 'm:' || e.target_entity_id::text,
            'label', e.edge_type::text,
            'provenance', 'meg'
          ) as j
        from public.meg_entity_edges e
        where e.source_entity_id in (
            select m.id
            from public.meg_entities m
            where m.status::text = 'active'
              and m.id in (
                select x.source_entity_id
                from public.meg_entity_edges x
                where x.edge_type::text in %s
                union
                select x.target_entity_id
                from public.meg_entity_edges x
                where x.edge_type::text in %s
              )
            order by m.updated_at desc
            limit %s
          )
          and e.target_entity_id in (
            select m.id
            from public.meg_entities m
            where m.status::text = 'active'
              and m.id in (
                select x.source_entity_id
                from public.meg_entity_edges x
                where x.edge_type::text in %s
                union
                select x.target_entity_id
                from public.meg_entity_edges x
                where x.edge_type::text in %s
              )
            order by m.updated_at desc
            limit %s
          )
        order by e.id
        limit %s
      ) q
      $q$,
      v_interesting_edge_types,
      v_interesting_edge_types,
      p_meg_node_limit,
      v_interesting_edge_types,
      v_interesting_edge_types,
      p_meg_node_limit,
      p_edge_limit
    );
    execute v_sql into v_meg_edges;
  end if;

  v_has_assets := to_regclass('public.asset_registry') is not null and v_has_meg;

  if v_has_assets then
    v_sql := format(
      $q$
      select coalesce(jsonb_agg(j ORDER BY ord), '[]'::jsonb)
      from (
        select
          row_number() over (order by ar.updated_at desc) as ord,
          jsonb_build_object(
            'id', 'a:' || ar.id::text,
            'name', coalesce(nullif(ar.label, ''), ar.asset_kind::text, 'Asset'),
            'kind', 'asset',
            'governance_scope', 'both',
            'source', 'asset_registry',
            'meg_entity_id', null,
            'client_id', null,
            'owner_meg_entity_id', ar.owner_entity_id::text
          ) as j
        from public.asset_registry ar
        where ar.owner_entity_id is not null
          and ar.owner_entity_id in (
            select m.id
            from public.meg_entities m
            where m.status::text = 'active'
              and m.id in (
                select e.source_entity_id
                from public.meg_entity_edges e
                where e.edge_type::text in %s
                union
                select e.target_entity_id
                from public.meg_entity_edges e
                where e.edge_type::text in %s
              )
            order by m.updated_at desc
            limit %s
          )
        order by ar.updated_at desc
        limit %s
      ) q
      $q$,
      v_interesting_edge_types,
      v_interesting_edge_types,
      p_meg_node_limit,
      p_asset_limit
    );
    execute v_sql into v_asset_nodes;

    v_sql := format(
      $q$
      select coalesce(jsonb_agg(j ORDER BY ord), '[]'::jsonb)
      from (
        select
          row_number() over (order by ar.id) as ord,
          jsonb_build_object(
            'id', 'own-asset:' || ar.id::text,
            'source', 'm:' || ar.owner_entity_id::text,
            'target', 'a:' || ar.id::text,
            'label', 'owns',
            'provenance', 'asset_registry'
          ) as j
        from public.asset_registry ar
        where ar.owner_entity_id is not null
          and ar.owner_entity_id in (
            select m.id
            from public.meg_entities m
            where m.status::text = 'active'
              and m.id in (
                select e.source_entity_id
                from public.meg_entity_edges e
                where e.edge_type::text in %s
                union
                select e.target_entity_id
                from public.meg_entity_edges e
                where e.edge_type::text in %s
              )
            order by m.updated_at desc
            limit %s
          )
        order by ar.id
        limit %s
      ) q
      $q$,
      v_interesting_edge_types,
      v_interesting_edge_types,
      p_meg_node_limit,
      p_asset_limit
    );
    execute v_sql into v_asset_edges;
  end if;

  return jsonb_build_object(
    'nodes', coalesce(v_works_nodes, '[]'::jsonb) || coalesce(v_meg_nodes, '[]'::jsonb) || coalesce(v_asset_nodes, '[]'::jsonb),
    'edges', coalesce(v_works_edges, '[]'::jsonb) || coalesce(v_meg_edges, '[]'::jsonb) || coalesce(v_asset_edges, '[]'::jsonb)
  );
end;
$body$;

revoke all on function public.ow_fetch_unified_graph(integer, integer, integer, integer) from public;
grant execute on function public.ow_fetch_unified_graph(integer, integer, integer, integer) to authenticated;

comment on function public.ow_fetch_unified_graph(integer, integer, integer, integer) is
  'Unified Workbench graph: works.entities/edges + optional MEG + asset_registry ownership links. v2 widens the interesting-edge filter to cover the friendly-label taxonomy added in 20260524000001.';;
