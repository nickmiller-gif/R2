CREATE OR REPLACE FUNCTION public.truth_market_promote(
  p_title text,
  p_institution_gap_summary text,
  p_description text DEFAULT NULL,
  p_source_system text DEFAULT NULL,
  p_affected_domains text[] DEFAULT '{}'::text[],
  p_owner_user_id uuid DEFAULT NULL,
  p_primary_thesis_id uuid DEFAULT NULL,
  p_platform_feed_item_ids uuid[] DEFAULT '{}'::uuid[],
  p_oracle_evidence_item_ids uuid[] DEFAULT '{}'::uuid[],
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_contradiction_summary jsonb DEFAULT '[]'::jsonb,
  p_proof_plan jsonb DEFAULT '{}'::jsonb,
  p_governance_requirements jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_opp_id uuid;
  v_brief_id uuid;
  v_feed_id uuid;
  v_ev_id uuid;
  v_meta jsonb;
BEGIN
  v_uid := COALESCE(p_owner_user_id, auth.uid());
  IF v_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'owner_user_id or authenticated session required';
  END IF;
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.charter_user_roles cur
    WHERE cur.user_id = auth.uid()
      AND cur.role::text IN ('operator', 'counsel', 'admin')
  ) THEN
    RAISE EXCEPTION 'operator role required';
  END IF;
  v_meta := COALESCE(p_metadata, '{}'::jsonb);
  IF p_source_system IS NOT NULL THEN
    v_meta := v_meta || jsonb_build_object('source_system', p_source_system);
  END IF;
  INSERT INTO public.oracle_opportunities (title, description, primary_thesis_id, affected_domains, owner_user_id, status, metadata, contradiction_flags, recommended_next_action)
  VALUES (p_title, p_description, p_primary_thesis_id, COALESCE(p_affected_domains, '{}'::text[]), v_uid, 'draft', v_meta, COALESCE(p_contradiction_summary, '[]'::jsonb), 'Review Missing Institution Brief and attach proof plan')
  RETURNING id INTO v_opp_id;
  INSERT INTO public.oracle_opportunity_transitions (opportunity_id, from_status, to_status, transitioned_by, rationale)
  VALUES (v_opp_id, NULL, 'draft', v_uid, 'truth_market_promote');
  INSERT INTO public.missing_institution_briefs (title, institution_gap_summary, status, primary_opportunity_id, affected_domains, owner_user_id, metadata, contradiction_summary, proof_plan, governance_requirements)
  VALUES (p_title, p_institution_gap_summary, 'draft', v_opp_id, COALESCE(p_affected_domains, '{}'::text[]), v_uid, v_meta, COALESCE(p_contradiction_summary, '[]'::jsonb), COALESCE(p_proof_plan, '{}'::jsonb), COALESCE(p_governance_requirements, '{}'::jsonb))
  RETURNING id INTO v_brief_id;
  FOREACH v_feed_id IN ARRAY COALESCE(p_platform_feed_item_ids, '{}'::uuid[]) LOOP
    IF v_feed_id IS NOT NULL THEN
      INSERT INTO public.missing_institution_evidence_links (brief_id, link_role, platform_feed_item_id) VALUES (v_brief_id, 'supporting', v_feed_id);
    END IF;
  END LOOP;
  FOREACH v_ev_id IN ARRAY COALESCE(p_oracle_evidence_item_ids, '{}'::uuid[]) LOOP
    IF v_ev_id IS NOT NULL THEN
      INSERT INTO public.missing_institution_evidence_links (brief_id, link_role, oracle_evidence_item_id) VALUES (v_brief_id, 'supporting', v_ev_id);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('opportunity_id', v_opp_id, 'brief_id', v_brief_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.truth_market_promote_feed_cluster(
  p_source_system text,
  p_limit integer DEFAULT 5,
  p_title text DEFAULT NULL,
  p_owner_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feed_ids uuid[] := '{}'::uuid[];
  v_summary text;
  v_title text;
  v_domains text[] := '{}'::text[];
BEGIN
  IF p_source_system IS NULL OR char_length(trim(p_source_system)) = 0 THEN
    RAISE EXCEPTION 'p_source_system is required';
  END IF;
  SELECT COALESCE(array_agg(id ORDER BY ingested_at DESC), '{}'::uuid[]) INTO v_feed_ids FROM (
    SELECT id, ingested_at FROM public.platform_feed_items WHERE source_system = p_source_system ORDER BY ingested_at DESC LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 5), 25))
  ) sub;
  IF cardinality(v_feed_ids) = 0 THEN
    RAISE EXCEPTION 'no platform_feed_items for source_system %', p_source_system;
  END IF;
  SELECT string_agg(left(summary, 120), ' · ' ORDER BY ingested_at DESC) INTO v_summary FROM public.platform_feed_items WHERE id = ANY (v_feed_ids);
  v_title := COALESCE(p_title, 'Missing institution — ' || p_source_system || ' (' || cardinality(v_feed_ids)::text || ' signals)');
  v_domains := CASE p_source_system
    WHEN 'centralr2' THEN ARRAY['platform_core']
    WHEN 'operator_workbench' THEN ARRAY['autonomous_ops']
    WHEN 'r2chart' THEN ARRAY['platform_core']
    WHEN 'ip_pulse_point' THEN ARRAY['ip_patent']
    ELSE ARRAY['platform_core']
  END;
  RETURN public.truth_market_promote(v_title, COALESCE(v_summary, 'Clustered feed signals for ' || p_source_system), 'Auto-drafted from recent platform_feed_items', p_source_system, v_domains, p_owner_user_id, NULL, v_feed_ids, '{}'::uuid[], jsonb_build_object('promotion', 'feed_cluster', 'feed_count', cardinality(v_feed_ids)), '[]'::jsonb, jsonb_build_object('steps', jsonb_build_array('Verify feed provenance', 'MEG entity resolve', 'Operator review')), jsonb_build_object('charter_review', true));
END;
$$;

GRANT EXECUTE ON FUNCTION public.truth_market_promote TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.truth_market_promote_feed_cluster TO authenticated, service_role;;
