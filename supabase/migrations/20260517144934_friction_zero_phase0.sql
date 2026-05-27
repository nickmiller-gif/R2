-- Friction Zero phase 0 — local dossier lifecycle on Eigen (R2 Works module).
-- Does not replace continuity_friction_surfaces (R2Chart lane) or oracle scoring.

DO $$ BEGIN
  CREATE TYPE public.friction_dossier_status AS ENUM (
    'draft',
    'watching',
    'validated',
    'converted_to_opportunity',
    'dismissed',
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.friction_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.friction_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES public.friction_markets(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (market_id, slug)
);

CREATE TABLE IF NOT EXISTS public.friction_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid REFERENCES public.friction_markets(id) ON DELETE SET NULL,
  friction_node_id uuid REFERENCES public.friction_nodes(id) ON DELETE SET NULL,
  market text NOT NULL,
  friction_node text NOT NULL,
  title text NOT NULL,
  collapse_thesis text NOT NULL,
  friction_being_monetized text NOT NULL,
  ai_attack_surface text NOT NULL,
  revenue_pool_exposed text NOT NULL,
  collapse_sequence jsonb NOT NULL DEFAULT '[]'::jsonb,
  replacement_interface text,
  investable_play text,
  r2_angle text,
  exposed_actors jsonb NOT NULL DEFAULT '[]'::jsonb,
  survivors jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_thesis numeric(4,3) CHECK (confidence_thesis IS NULL OR (confidence_thesis >= 0 AND confidence_thesis <= 1)),
  confidence_economic numeric(4,3) CHECK (confidence_economic IS NULL OR (confidence_economic >= 0 AND confidence_economic <= 1)),
  confidence_timing numeric(4,3) CHECK (confidence_timing IS NULL OR (confidence_timing >= 0 AND confidence_timing <= 1)),
  contradictions jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  policy_tags text[] NOT NULL DEFAULT '{}'::text[],
  exposure_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  friction_collapse_score numeric(5,2) CHECK (friction_collapse_score IS NULL OR (friction_collapse_score >= 0 AND friction_collapse_score <= 100)),
  status public.friction_dossier_status NOT NULL DEFAULT 'draft',
  outbound_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  oracle_opportunity_id uuid REFERENCES public.oracle_opportunities(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_friction_dossiers_status ON public.friction_dossiers (status);
CREATE INDEX IF NOT EXISTS idx_friction_dossiers_market ON public.friction_dossiers (market);
CREATE INDEX IF NOT EXISTS idx_friction_dossiers_created_at ON public.friction_dossiers (created_at DESC);

CREATE TABLE IF NOT EXISTS public.friction_dossier_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.friction_dossiers(id) ON DELETE CASCADE,
  link_role text NOT NULL DEFAULT 'supporting',
  title text NOT NULL,
  ref text,
  source_system text,
  confidence numeric(4,3),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_friction_dossier_evidence_dossier ON public.friction_dossier_evidence (dossier_id);

CREATE TABLE IF NOT EXISTS public.friction_watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_key text NOT NULL,
  label text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_key)
);

CREATE TABLE IF NOT EXISTS public.friction_outbound_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.friction_dossiers(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'preview',
  platform_feed_item_id uuid REFERENCES public.platform_feed_items(id) ON DELETE SET NULL,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_friction_outbound_events_dossier ON public.friction_outbound_events (dossier_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.friction_zero_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_friction_markets_updated_at ON public.friction_markets;
CREATE TRIGGER trg_friction_markets_updated_at
  BEFORE UPDATE ON public.friction_markets FOR EACH ROW EXECUTE FUNCTION public.friction_zero_set_updated_at();

DROP TRIGGER IF EXISTS trg_friction_dossiers_updated_at ON public.friction_dossiers;
CREATE TRIGGER trg_friction_dossiers_updated_at
  BEFORE UPDATE ON public.friction_dossiers FOR EACH ROW EXECUTE FUNCTION public.friction_zero_set_updated_at();

ALTER TABLE public.friction_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friction_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friction_dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friction_dossier_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friction_watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friction_outbound_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.friction_zero_is_operator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.charter_user_roles cur
    WHERE cur.user_id = (SELECT auth.uid())
      AND cur.role::text IN ('operator', 'counsel', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.friction_zero_is_operator() TO authenticated, service_role;

DO $policy$ BEGIN
  DROP POLICY IF EXISTS friction_markets_select ON public.friction_markets;
  CREATE POLICY friction_markets_select ON public.friction_markets FOR SELECT TO authenticated, service_role
    USING ((SELECT auth.role()) = 'service_role' OR public.friction_zero_is_operator());

  DROP POLICY IF EXISTS friction_nodes_select ON public.friction_nodes;
  CREATE POLICY friction_nodes_select ON public.friction_nodes FOR SELECT TO authenticated, service_role
    USING ((SELECT auth.role()) = 'service_role' OR public.friction_zero_is_operator());

  DROP POLICY IF EXISTS friction_dossiers_select ON public.friction_dossiers;
  CREATE POLICY friction_dossiers_select ON public.friction_dossiers FOR SELECT TO authenticated, service_role
    USING ((SELECT auth.role()) = 'service_role' OR public.friction_zero_is_operator());

  DROP POLICY IF EXISTS friction_dossiers_mutate ON public.friction_dossiers;
  CREATE POLICY friction_dossiers_insert ON public.friction_dossiers FOR INSERT TO authenticated
    WITH CHECK (public.friction_zero_is_operator());
  CREATE POLICY friction_dossiers_update ON public.friction_dossiers FOR UPDATE TO authenticated
    USING (public.friction_zero_is_operator()) WITH CHECK (public.friction_zero_is_operator());
  CREATE POLICY friction_dossiers_service ON public.friction_dossiers FOR ALL TO service_role USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS friction_evidence_select ON public.friction_dossier_evidence;
  CREATE POLICY friction_evidence_select ON public.friction_dossier_evidence FOR SELECT TO authenticated, service_role
    USING ((SELECT auth.role()) = 'service_role' OR public.friction_zero_is_operator());
  DROP POLICY IF EXISTS friction_evidence_mutate ON public.friction_dossier_evidence;
  CREATE POLICY friction_evidence_insert ON public.friction_dossier_evidence FOR INSERT TO authenticated
    WITH CHECK (public.friction_zero_is_operator());
  CREATE POLICY friction_evidence_service ON public.friction_dossier_evidence FOR ALL TO service_role USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS friction_watchlist_own ON public.friction_watchlist_items;
  CREATE POLICY friction_watchlist_select ON public.friction_watchlist_items FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.friction_zero_is_operator());
  CREATE POLICY friction_watchlist_mutate ON public.friction_watchlist_items FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

  DROP POLICY IF EXISTS friction_outbound_select ON public.friction_outbound_events;
  CREATE POLICY friction_outbound_select ON public.friction_outbound_events FOR SELECT TO authenticated, service_role
    USING ((SELECT auth.role()) = 'service_role' OR public.friction_zero_is_operator());
  DROP POLICY IF EXISTS friction_outbound_insert ON public.friction_outbound_events;
  CREATE POLICY friction_outbound_insert ON public.friction_outbound_events FOR INSERT TO authenticated
    WITH CHECK (public.friction_zero_is_operator());
  CREATE POLICY friction_outbound_service ON public.friction_outbound_events FOR ALL TO service_role USING (true) WITH CHECK (true);
END $policy$;

INSERT INTO public.friction_markets (slug, title, description)
VALUES (
  'real-estate-transaction-compression',
  'Real Estate Transaction Compression',
  'Where transaction workflows still depend on human friction and AI agents compress fee pools.'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.friction_nodes (market_id, slug, title, sort_order)
SELECT m.id, v.slug, v.title, v.ord
FROM public.friction_markets m
CROSS JOIN (VALUES
  ('buyer-representation', 'Buyer representation', 1),
  ('seller-lead-generation', 'Seller lead generation', 2),
  ('property-search', 'Property search', 3),
  ('comparable-sale-analysis', 'Comparable sale analysis', 4),
  ('offer-strategy', 'Offer strategy', 5),
  ('inspection-triage', 'Inspection triage', 6),
  ('contract-review', 'Contract review', 7),
  ('title-escrow-coordination', 'Title / escrow coordination', 8),
  ('insurance-shopping', 'Insurance shopping', 9),
  ('mortgage-prequalification', 'Mortgage prequalification', 10),
  ('closing-checklist', 'Closing checklist management', 11),
  ('post-closing-compliance', 'Post-closing compliance', 12),
  ('property-document-review', 'Property document review', 13),
  ('lease-obligation-extraction', 'Lease / obligation extraction', 14),
  ('portfolio-monitoring', 'Portfolio monitoring', 15)
) AS v(slug, title, ord)
WHERE m.slug = 'real-estate-transaction-compression'
ON CONFLICT (market_id, slug) DO NOTHING;;
