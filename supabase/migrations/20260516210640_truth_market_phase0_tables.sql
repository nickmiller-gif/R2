DO $$ BEGIN CREATE TYPE public.oracle_opportunity_status AS ENUM ('draft','active','validate','won','lost','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.missing_institution_brief_status AS ENUM ('draft','review','published','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.oracle_opportunities (
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

CREATE INDEX idx_oracle_opportunities_status ON public.oracle_opportunities (status);
CREATE INDEX idx_oracle_opportunities_owner ON public.oracle_opportunities (owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX idx_oracle_opportunities_created_at ON public.oracle_opportunities (created_at DESC);

CREATE TABLE public.oracle_opportunity_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.oracle_opportunities(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  transitioned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  transitioned_at timestamptz NOT NULL DEFAULT now(),
  rationale text
);
CREATE INDEX idx_oracle_opportunity_transitions_opp ON public.oracle_opportunity_transitions (opportunity_id, transitioned_at DESC);

CREATE TABLE public.missing_institution_briefs (
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
CREATE INDEX idx_missing_institution_briefs_status ON public.missing_institution_briefs (status);
CREATE INDEX idx_missing_institution_briefs_opportunity ON public.missing_institution_briefs (primary_opportunity_id) WHERE primary_opportunity_id IS NOT NULL;

CREATE TABLE public.missing_institution_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL REFERENCES public.missing_institution_briefs(id) ON DELETE CASCADE,
  link_role text NOT NULL DEFAULT 'supporting',
  platform_feed_item_id uuid REFERENCES public.platform_feed_items(id) ON DELETE CASCADE,
  oracle_evidence_item_id uuid REFERENCES public.oracle_evidence_items(id) ON DELETE CASCADE,
  knowledge_chunk_id uuid REFERENCES public.knowledge_chunks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT missing_institution_evidence_one_target CHECK (((platform_feed_item_id IS NOT NULL)::int + (oracle_evidence_item_id IS NOT NULL)::int + (knowledge_chunk_id IS NOT NULL)::int) = 1)
);
CREATE INDEX idx_mib_evidence_brief ON public.missing_institution_evidence_links (brief_id);

CREATE OR REPLACE FUNCTION public.truth_market_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_oracle_opportunities_updated_at BEFORE UPDATE ON public.oracle_opportunities FOR EACH ROW EXECUTE FUNCTION public.truth_market_set_updated_at();
CREATE TRIGGER trg_missing_institution_briefs_updated_at BEFORE UPDATE ON public.missing_institution_briefs FOR EACH ROW EXECUTE FUNCTION public.truth_market_set_updated_at();

ALTER TABLE public.oracle_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_opportunity_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missing_institution_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missing_institution_evidence_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_opportunities ON public.oracle_opportunities FOR SELECT TO authenticated, service_role USING ((SELECT auth.role()) = 'service_role' OR EXISTS (SELECT 1 FROM public.charter_user_roles cur WHERE cur.user_id = (SELECT auth.uid()) AND cur.role::text IN ('operator', 'counsel', 'admin')));
CREATE POLICY mutate_oracle_opportunities ON public.oracle_opportunities FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY insert_oracle_opportunities_operator ON public.oracle_opportunities FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.charter_user_roles cur WHERE cur.user_id = (SELECT auth.uid()) AND cur.role::text IN ('operator', 'counsel', 'admin')));
CREATE POLICY update_oracle_opportunities_operator ON public.oracle_opportunities FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.charter_user_roles cur WHERE cur.user_id = (SELECT auth.uid()) AND cur.role::text IN ('operator', 'counsel', 'admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.charter_user_roles cur WHERE cur.user_id = (SELECT auth.uid()) AND cur.role::text IN ('operator', 'counsel', 'admin')));
CREATE POLICY select_oracle_opportunity_transitions ON public.oracle_opportunity_transitions FOR SELECT TO authenticated, service_role USING ((SELECT auth.role()) = 'service_role' OR EXISTS (SELECT 1 FROM public.charter_user_roles cur WHERE cur.user_id = (SELECT auth.uid()) AND cur.role::text IN ('operator', 'counsel', 'admin')));
CREATE POLICY insert_oracle_opportunity_transitions ON public.oracle_opportunity_transitions FOR INSERT TO authenticated, service_role WITH CHECK ((SELECT auth.role()) = 'service_role' OR EXISTS (SELECT 1 FROM public.charter_user_roles cur WHERE cur.user_id = (SELECT auth.uid()) AND cur.role::text IN ('operator', 'counsel', 'admin')));
CREATE POLICY select_missing_institution_briefs ON public.missing_institution_briefs FOR SELECT TO authenticated, service_role USING ((SELECT auth.role()) = 'service_role' OR EXISTS (SELECT 1 FROM public.charter_user_roles cur WHERE cur.user_id = (SELECT auth.uid()) AND cur.role::text IN ('operator', 'counsel', 'admin')));
CREATE POLICY mutate_missing_institution_briefs_service ON public.missing_institution_briefs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY insert_missing_institution_briefs_operator ON public.missing_institution_briefs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.charter_user_roles cur WHERE cur.user_id = (SELECT auth.uid()) AND cur.role::text IN ('operator', 'counsel', 'admin')));
CREATE POLICY update_missing_institution_briefs_operator ON public.missing_institution_briefs FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.charter_user_roles cur WHERE cur.user_id = (SELECT auth.uid()) AND cur.role::text IN ('operator', 'counsel', 'admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.charter_user_roles cur WHERE cur.user_id = (SELECT auth.uid()) AND cur.role::text IN ('operator', 'counsel', 'admin')));
CREATE POLICY select_mib_evidence_links ON public.missing_institution_evidence_links FOR SELECT TO authenticated, service_role USING ((SELECT auth.role()) = 'service_role' OR EXISTS (SELECT 1 FROM public.charter_user_roles cur WHERE cur.user_id = (SELECT auth.uid()) AND cur.role::text IN ('operator', 'counsel', 'admin')));
CREATE POLICY mutate_mib_evidence_links ON public.missing_institution_evidence_links FOR ALL TO service_role USING (true) WITH CHECK (true);;
