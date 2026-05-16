-- Truth Market phase 0: oracle_opportunities + missing_institution_briefs + promotion RPC.
-- ADR: R2/docs/adr/ADR-0009-truth-market-layer.md

-- ─── Opportunity status ───────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.oracle_opportunity_status AS ENUM (
    'draft',
    'active',
    'validate',
    'won',
    'lost',
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.missing_institution_brief_status AS ENUM (
    'draft',
    'review',
    'published',
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Oracle opportunities (Wire Plan §6.2 minimal) ───────────────────
CREATE TABLE IF NOT EXISTS public.oracle_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  primary_thesis_id uuid REFERENCES public.oracle_theses(id) ON DELETE SET NULL,
  evidence_pack_ref jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_meg_entities uuid[] NOT NULL DEFAULT '{}'::uuid[],
  affected_domains text[] NOT NULL DEFAULT '{}'::text[],
  buyer_or_beneficiary text,
  economic_value_estimate numeric,
  economic_value_basis text,
  confidence numeric(4, 3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  contradiction_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_next_action text,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.oracle_opportunity_status NOT NULL DEFAULT 'draft',
  outcome_status text CHECK (outcome_status IS NULL OR outcome_status IN ('won', 'lost', 'abandoned')),
  outcome_revenue numeric,
  outcome_closed_at timestamptz,
  outcome_learnings text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oracle_opportunities_status
  ON public.oracle_opportunities (status);
CREATE INDEX IF NOT EXISTS idx_oracle_opportunities_owner
  ON public.oracle_opportunities (owner_user_id)
  WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oracle_opportunities_created_at
  ON public.oracle_opportunities (created_at DESC);

CREATE TABLE IF NOT EXISTS public.oracle_opportunity_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.oracle_opportunities(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  transitioned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  transitioned_at timestamptz NOT NULL DEFAULT now(),
  rationale text
);

CREATE INDEX IF NOT EXISTS idx_oracle_opportunity_transitions_opp
  ON public.oracle_opportunity_transitions (opportunity_id, transitioned_at DESC);

-- ─── Missing institution briefs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.missing_institution_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  institution_gap_summary text NOT NULL,
  status public.missing_institution_brief_status NOT NULL DEFAULT 'draft',
  primary_opportunity_id uuid REFERENCES public.oracle_opportunities(id) ON DELETE SET NULL,
  affected_domains text[] NOT NULL DEFAULT '{}'::text[],
  related_meg_entity_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  contradiction_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  proof_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  governance_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  kill_tests jsonb NOT NULL DEFAULT '[]'::jsonb,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_missing_institution_briefs_status
  ON public.missing_institution_briefs (status);
CREATE INDEX IF NOT EXISTS idx_missing_institution_briefs_opportunity
  ON public.missing_institution_briefs (primary_opportunity_id)
  WHERE primary_opportunity_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.missing_institution_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL REFERENCES public.missing_institution_briefs(id) ON DELETE CASCADE,
  link_role text NOT NULL DEFAULT 'supporting',
  platform_feed_item_id uuid REFERENCES public.platform_feed_items(id) ON DELETE CASCADE,
  oracle_evidence_item_id uuid REFERENCES public.oracle_evidence_items(id) ON DELETE CASCADE,
  knowledge_chunk_id uuid REFERENCES public.knowledge_chunks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT missing_institution_evidence_one_target CHECK (
    (
      (platform_feed_item_id IS NOT NULL)::int
      + (oracle_evidence_item_id IS NOT NULL)::int
      + (knowledge_chunk_id IS NOT NULL)::int
    ) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_mib_evidence_brief
  ON public.missing_institution_evidence_links (brief_id);

-- ─── updated_at triggers ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.truth_market_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_oracle_opportunities_updated_at ON public.oracle_opportunities;
CREATE TRIGGER trg_oracle_opportunities_updated_at
  BEFORE UPDATE ON public.oracle_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.truth_market_set_updated_at();

DROP TRIGGER IF EXISTS trg_missing_institution_briefs_updated_at ON public.missing_institution_briefs;
CREATE TRIGGER trg_missing_institution_briefs_updated_at
  BEFORE UPDATE ON public.missing_institution_briefs
  FOR EACH ROW EXECUTE FUNCTION public.truth_market_set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.oracle_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_opportunity_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missing_institution_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missing_institution_evidence_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_oracle_opportunities ON public.oracle_opportunities;
CREATE POLICY select_oracle_opportunities ON public.oracle_opportunities
  FOR SELECT TO authenticated, service_role
  USING (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS mutate_oracle_opportunities ON public.oracle_opportunities;
CREATE POLICY mutate_oracle_opportunities ON public.oracle_opportunities
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS insert_oracle_opportunities_operator ON public.oracle_opportunities;
CREATE POLICY insert_oracle_opportunities_operator ON public.oracle_opportunities
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS update_oracle_opportunities_operator ON public.oracle_opportunities;
CREATE POLICY update_oracle_opportunities_operator ON public.oracle_opportunities
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS select_oracle_opportunity_transitions ON public.oracle_opportunity_transitions;
CREATE POLICY select_oracle_opportunity_transitions ON public.oracle_opportunity_transitions
  FOR SELECT TO authenticated, service_role
  USING (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS insert_oracle_opportunity_transitions ON public.oracle_opportunity_transitions;
CREATE POLICY insert_oracle_opportunity_transitions ON public.oracle_opportunity_transitions
  FOR INSERT TO authenticated, service_role
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS select_missing_institution_briefs ON public.missing_institution_briefs;
CREATE POLICY select_missing_institution_briefs ON public.missing_institution_briefs
  FOR SELECT TO authenticated, service_role
  USING (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS mutate_missing_institution_briefs_service ON public.missing_institution_briefs;
CREATE POLICY mutate_missing_institution_briefs_service ON public.missing_institution_briefs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS insert_missing_institution_briefs_operator ON public.missing_institution_briefs;
CREATE POLICY insert_missing_institution_briefs_operator ON public.missing_institution_briefs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS update_missing_institution_briefs_operator ON public.missing_institution_briefs;
CREATE POLICY update_missing_institution_briefs_operator ON public.missing_institution_briefs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS select_mib_evidence_links ON public.missing_institution_evidence_links;
CREATE POLICY select_mib_evidence_links ON public.missing_institution_evidence_links
  FOR SELECT TO authenticated, service_role
  USING (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS mutate_mib_evidence_links ON public.missing_institution_evidence_links;
CREATE POLICY mutate_mib_evidence_links ON public.missing_institution_evidence_links
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── Promotion RPC (operator + service role) ─────────────────────────
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

  INSERT INTO public.oracle_opportunities (
    title,
    description,
    primary_thesis_id,
    affected_domains,
    owner_user_id,
    status,
    metadata,
    contradiction_flags,
    recommended_next_action
  ) VALUES (
    p_title,
    p_description,
    p_primary_thesis_id,
    COALESCE(p_affected_domains, '{}'::text[]),
    v_uid,
    'draft',
    v_meta,
    COALESCE(p_contradiction_summary, '[]'::jsonb),
    'Review Missing Institution Brief and attach proof plan'
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

  FOREACH v_feed_id IN ARRAY COALESCE(p_platform_feed_item_ids, '{}'::uuid[]) LOOP
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

  SELECT COALESCE(array_agg(id ORDER BY ingested_at DESC), '{}'::uuid[])
  INTO v_feed_ids
  FROM (
    SELECT id, ingested_at
    FROM public.platform_feed_items
    WHERE source_system = p_source_system
    ORDER BY ingested_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 5), 25))
  ) sub;

  IF cardinality(v_feed_ids) = 0 THEN
    RAISE EXCEPTION 'no platform_feed_items for source_system %', p_source_system;
  END IF;

  SELECT string_agg(left(summary, 120), ' · ' ORDER BY ingested_at DESC)
  INTO v_summary
  FROM public.platform_feed_items
  WHERE id = ANY (v_feed_ids);

  v_title := COALESCE(
    p_title,
    'Missing institution — ' || p_source_system || ' (' || cardinality(v_feed_ids)::text || ' signals)'
  );

  v_domains := CASE p_source_system
    WHEN 'centralr2' THEN ARRAY['platform_core']
    WHEN 'operator_workbench' THEN ARRAY['autonomous_ops']
    WHEN 'r2chart' THEN ARRAY['platform_core']
    WHEN 'ip_pulse_point' THEN ARRAY['ip_patent']
    ELSE ARRAY['platform_core']
  END;

  RETURN public.truth_market_promote(
    v_title,
    COALESCE(v_summary, 'Clustered feed signals for ' || p_source_system),
    'Auto-drafted from recent platform_feed_items',
    p_source_system,
    v_domains,
    p_owner_user_id,
    NULL,
    v_feed_ids,
    '{}'::uuid[],
    jsonb_build_object('promotion', 'feed_cluster', 'feed_count', cardinality(v_feed_ids)),
    '[]'::jsonb,
    jsonb_build_object('steps', jsonb_build_array('Verify feed provenance', 'MEG entity resolve', 'Operator review')),
    jsonb_build_object('charter_review', true)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.truth_market_promote TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.truth_market_promote_feed_cluster TO authenticated, service_role;

COMMENT ON TABLE public.missing_institution_briefs IS
  'Truth Market: governed missing-institution objects derived from opportunities and evidence.';
COMMENT ON TABLE public.oracle_opportunities IS
  'Truth Market / Phase 4: operator-facing opportunity portfolio on Eigen.';
