-- Ensure manual Truth Market promotions persist source_system and feed IDs
-- onto oracle_opportunities, not only metadata/evidence links.

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
  v_platform_feed_item_ids uuid[] := '{}'::uuid[];
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

  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT item
      FROM unnest(COALESCE(p_platform_feed_item_ids, '{}'::uuid[])) AS item
      WHERE item IS NOT NULL
    ),
    '{}'::uuid[]
  )
  INTO v_platform_feed_item_ids;

  INSERT INTO public.oracle_opportunities (
    title,
    description,
    primary_thesis_id,
    affected_domains,
    owner_user_id,
    status,
    metadata,
    contradiction_flags,
    recommended_next_action,
    source_system,
    platform_feed_item_ids
  ) VALUES (
    p_title,
    p_description,
    p_primary_thesis_id,
    COALESCE(p_affected_domains, '{}'::text[]),
    v_uid,
    'draft',
    v_meta,
    COALESCE(p_contradiction_summary, '[]'::jsonb),
    'Review Missing Institution Brief and attach proof plan',
    p_source_system,
    v_platform_feed_item_ids
  )
  RETURNING id INTO v_opp_id;

  INSERT INTO public.oracle_opportunity_transitions (
    opportunity_id,
    from_status,
    to_status,
    transitioned_by,
    rationale
  ) VALUES (
    v_opp_id,
    NULL,
    'draft',
    v_uid,
    'truth_market_promote'
  );

  INSERT INTO public.missing_institution_briefs (
    title,
    institution_gap_summary,
    status,
    primary_opportunity_id,
    affected_domains,
    owner_user_id,
    metadata,
    contradiction_summary,
    proof_plan,
    governance_requirements
  ) VALUES (
    p_title,
    p_institution_gap_summary,
    'draft',
    v_opp_id,
    COALESCE(p_affected_domains, '{}'::text[]),
    v_uid,
    v_meta,
    COALESCE(p_contradiction_summary, '[]'::jsonb),
    COALESCE(p_proof_plan, '{}'::jsonb),
    COALESCE(p_governance_requirements, '{}'::jsonb)
  )
  RETURNING id INTO v_brief_id;

  FOREACH v_feed_id IN ARRAY v_platform_feed_item_ids LOOP
    IF v_feed_id IS NOT NULL THEN
      INSERT INTO public.missing_institution_evidence_links (
        brief_id, link_role, platform_feed_item_id
      ) VALUES (v_brief_id, 'supporting', v_feed_id);
    END IF;
  END LOOP;

  FOREACH v_ev_id IN ARRAY COALESCE(p_oracle_evidence_item_ids, '{}'::uuid[]) LOOP
    IF v_ev_id IS NOT NULL THEN
      INSERT INTO public.missing_institution_evidence_links (
        brief_id, link_role, oracle_evidence_item_id
      ) VALUES (v_brief_id, 'supporting', v_ev_id);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'opportunity_id', v_opp_id,
    'brief_id', v_brief_id
  );
END;
$$;

