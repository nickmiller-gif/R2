-- Meta-B: read-only provenance chain for operator-workbench + portal.
-- Returns a bounded JSON tree: root feed item or MEG entity, linked MEG nodes,
-- meg_entity_edges, optional oracle_evidence_items.

CREATE OR REPLACE FUNCTION public.provenance_chain(
  p_target_id uuid,
  p_target_kind text,
  p_max_depth integer DEFAULT 4,
  p_max_nodes integer DEFAULT 80
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO public
AS $func$
DECLARE
  nodes jsonb := '[]'::jsonb;
  node jsonb;
  fi public.platform_feed_items%ROWTYPE;
  meg_row public.meg_entities%ROWTYPE;
  root_entity public.meg_entities%ROWTYPE;
  ed public.meg_entity_edges%ROWTYPE;
  ev public.oracle_evidence_items%ROWTYPE;
  root_key text;
  meg_ids uuid[];
BEGIN
  IF p_max_depth < 1 THEN
    p_max_depth := 1;
  END IF;
  IF p_max_nodes < 4 THEN
    p_max_nodes := 4;
  END IF;

  IF p_target_kind NOT IN ('platform_feed_item', 'meg_entity') THEN
    RETURN jsonb_build_object(
      'nodes', '[]'::jsonb,
      'error', to_jsonb('invalid target_kind: use platform_feed_item | meg_entity'::text)
    );
  END IF;

  -- ── platform_feed_item ─────────────────────────────────────────────
  IF p_target_kind = 'platform_feed_item' THEN
    SELECT * INTO fi FROM public.platform_feed_items WHERE id = p_target_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'nodes', '[]'::jsonb,
        'error', to_jsonb('platform_feed_item not found'::text)
      );
    END IF;

    root_key := 'pfi:' || fi.id::text;
    node := jsonb_build_object(
      'id', root_key,
      'parent_id', NULL,
      'kind', 'platform_feed_item',
      'title', left(coalesce(nullif(trim(fi.summary), ''), '(no summary)'), 240),
      'subtitle', fi.source_system || ' · ' || fi.source_event_type,
      'depth', 0,
      'meta', jsonb_strip_nulls(
        jsonb_build_object(
          'platform_feed_item_id', fi.id,
          'ingested_at', fi.ingested_at,
          'processing_status', fi.processing_status,
          'source_signal_key', fi.source_signal_key,
          'evidence_item_id', fi.evidence_item_id,
          'actor_meg_entity_id', fi.actor_meg_entity_id
        )
      )
    );
    nodes := nodes || jsonb_build_array(node);

    meg_ids := ARRAY(
      SELECT DISTINCT x
      FROM unnest(
        coalesce(fi.related_entity_ids, array[]::uuid[])
        || CASE
          WHEN fi.actor_meg_entity_id IS NOT NULL THEN ARRAY[fi.actor_meg_entity_id]
          ELSE array[]::uuid[]
        END
      ) AS t(x)
    );

    FOR meg_row IN
      SELECT e.*
      FROM public.meg_entities e
      WHERE e.id = ANY (meg_ids)
      ORDER BY e.canonical_name
      LIMIT 25
    LOOP
      EXIT WHEN jsonb_array_length(nodes) >= p_max_nodes;
      node := jsonb_build_object(
        'id', 'meg:' || meg_row.id::text,
        'parent_id', root_key,
        'kind', 'meg_entity',
        'title', meg_row.canonical_name,
        'subtitle', meg_row.entity_type::text,
        'depth', 1,
        'meta', jsonb_build_object('meg_entity_id', meg_row.id)
      );
      nodes := nodes || jsonb_build_array(node);
    END LOOP;

    FOR ed IN
      SELECT e.*
      FROM public.meg_entity_edges e
      WHERE (
        e.source_entity_id = ANY (meg_ids)
        OR e.target_entity_id = ANY (meg_ids)
      )
      ORDER BY e.created_at DESC
      LIMIT 30
    LOOP
      EXIT WHEN jsonb_array_length(nodes) >= p_max_nodes;
      node := jsonb_build_object(
        'id', 'edge:' || ed.id::text,
        'parent_id', 'meg:' || ed.source_entity_id::text,
        'kind', 'meg_entity_edge',
        'title', ed.edge_type::text,
        'subtitle', '→ ' || (
          SELECT m.canonical_name
          FROM public.meg_entities m
          WHERE m.id = ed.target_entity_id
        ),
        'depth', 2,
        'meta', jsonb_build_object(
          'edge_id', ed.id,
          'source_entity_id', ed.source_entity_id,
          'target_entity_id', ed.target_entity_id,
          'confidence', ed.confidence
        )
      );
      nodes := nodes || jsonb_build_array(node);
    END LOOP;

    IF fi.evidence_item_id IS NOT NULL AND jsonb_array_length(nodes) < p_max_nodes THEN
      SELECT * INTO ev
      FROM public.oracle_evidence_items o
      WHERE o.id = fi.evidence_item_id;
      IF FOUND THEN
        node := jsonb_build_object(
          'id', 'evi:' || ev.id::text,
          'parent_id', root_key,
          'kind', 'oracle_evidence_item',
          'title', left(coalesce(nullif(trim(ev.content_summary), ''), '(evidence)'), 200),
          'subtitle', ev.source_lane || ' · ' || ev.source_class,
          'depth', 1,
          'meta', jsonb_build_object('evidence_item_id', ev.id)
        );
        nodes := nodes || jsonb_build_array(node);
      END IF;
    END IF;

    RETURN jsonb_build_object('nodes', nodes);
  END IF;

  -- ── meg_entity ─────────────────────────────────────────────────────
  SELECT * INTO root_entity FROM public.meg_entities WHERE id = p_target_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'nodes', '[]'::jsonb,
      'error', to_jsonb('meg_entity not found'::text)
    );
  END IF;

  root_key := 'meg:' || root_entity.id::text;
  node := jsonb_build_object(
    'id', root_key,
    'parent_id', NULL,
    'kind', 'meg_entity',
    'title', root_entity.canonical_name,
    'subtitle', root_entity.entity_type::text,
    'depth', 0,
    'meta', jsonb_build_object('meg_entity_id', root_entity.id)
  );
  nodes := nodes || jsonb_build_array(node);

  meg_ids := ARRAY[p_target_id];

  FOR ed IN
    SELECT e.*
    FROM public.meg_entity_edges e
    WHERE e.source_entity_id = p_target_id OR e.target_entity_id = p_target_id
    ORDER BY e.created_at DESC
    LIMIT 40
  LOOP
    EXIT WHEN jsonb_array_length(nodes) >= p_max_nodes;
    node := jsonb_build_object(
      'id', 'edge:' || ed.id::text,
      'parent_id', root_key,
      'kind', 'meg_entity_edge',
      'title', ed.edge_type::text,
      'subtitle', CASE
        WHEN ed.source_entity_id = p_target_id THEN '→ ' || (
          SELECT m.canonical_name FROM public.meg_entities m WHERE m.id = ed.target_entity_id
        )
        ELSE '← ' || (
          SELECT m.canonical_name FROM public.meg_entities m WHERE m.id = ed.source_entity_id
        )
      END,
      'depth', 1,
      'meta', jsonb_build_object(
        'edge_id', ed.id,
        'source_entity_id', ed.source_entity_id,
        'target_entity_id', ed.target_entity_id
      )
    );
    nodes := nodes || jsonb_build_array(node);
  END LOOP;

  RETURN jsonb_build_object('nodes', nodes);
END;
$func$;

COMMENT ON FUNCTION public.provenance_chain(uuid, text, integer, integer) IS
  'Meta-B: bounded provenance nodes for platform_feed_items or meg_entities. '
  'Revolutionary-features memo 2026-05-09; read-only; SECURITY INVOKER.';

GRANT EXECUTE ON FUNCTION public.provenance_chain(uuid, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.provenance_chain(uuid, text, integer, integer) TO service_role;
