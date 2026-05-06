-- R2Chart Continuity — Phase A foundation + read models + seed data
-- Workspace is explicit for future multi-tenant expansion; MVP uses one seeded workspace.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.continuity_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
      OR coalesce((auth.jwt() -> 'app_metadata' ->> 'continuity_role') = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.continuity_governance_status AS ENUM (
    'draft', 'active', 'under_review', 'sealed', 'revoked', 'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.continuity_ai_access_policy AS ENUM (
    'no_ai_access',
    'summaries_only',
    'retrieval_allowed',
    'agent_action_allowed',
    'public_safe',
    'sealed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.continuity_signal_channel_state AS ENUM (
    'planned', 'live', 'degraded', 'sealed', 'disabled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.continuity_agent_charter_status AS ENUM (
    'draft', 'active', 'suspended', 'revoked', 'expired', 'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.continuity_confidence_band AS ENUM ('high', 'mid', 'low');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.continuity_workspaces (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER continuity_workspaces_updated_at
  BEFORE UPDATE ON public.continuity_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.continuity_context_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.continuity_workspaces (id) ON DELETE CASCADE,
  display_code text NOT NULL,
  title text NOT NULL,
  description text,
  context_type text NOT NULL DEFAULT 'other',
  owner_label text,
  owner_external_ref text,
  custodian_label text,
  custodian_external_ref text,
  source_system text,
  source_record_id text,
  sensitivity_level text NOT NULL DEFAULT 'internal',
  ai_access_policy public.continuity_ai_access_policy NOT NULL DEFAULT 'summaries_only',
  governance_status public.continuity_governance_status NOT NULL DEFAULT 'active',
  confidence_band public.continuity_confidence_band NOT NULL DEFAULT 'mid',
  confidence_score numeric(5,2),
  freshness_score numeric(5,2),
  uniqueness_score numeric(5,2),
  economic_relevance_score numeric(5,2),
  continuity_risk_level text,
  contradiction_open_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, display_code)
);

CREATE INDEX idx_continuity_context_assets_workspace_created
  ON public.continuity_context_assets (workspace_id, created_at DESC);

CREATE TRIGGER continuity_context_assets_updated_at
  BEFORE UPDATE ON public.continuity_context_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.continuity_context_asset_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.continuity_workspaces (id) ON DELETE CASCADE,
  context_asset_id uuid NOT NULL REFERENCES public.continuity_context_assets (id) ON DELETE CASCADE,
  entity_label text,
  entity_type text NOT NULL DEFAULT 'unknown',
  relationship_type text NOT NULL DEFAULT 'related_to',
  external_system text,
  external_entity_id text,
  future_meg_entity_id uuid,
  confidence numeric(5,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_continuity_context_asset_entities_asset
  ON public.continuity_context_asset_entities (context_asset_id);

CREATE TABLE IF NOT EXISTS public.continuity_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.continuity_workspaces (id) ON DELETE CASCADE,
  context_asset_id uuid REFERENCES public.continuity_context_assets (id) ON DELETE CASCADE,
  claim_id uuid,
  source_system text,
  source_record_id text,
  source_url text,
  evidence_type text,
  evidence_summary text,
  provenance_status text NOT NULL DEFAULT 'unsigned',
  source_authority text NOT NULL DEFAULT 'unknown',
  freshness_band text NOT NULL DEFAULT 'aging',
  contradiction_state text NOT NULL DEFAULT 'none',
  review_posture text NOT NULL DEFAULT 'auto',
  missing_proof_item text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_continuity_evidence_links_workspace_created
  ON public.continuity_evidence_links (workspace_id, created_at DESC);

CREATE INDEX idx_continuity_evidence_links_asset
  ON public.continuity_evidence_links (context_asset_id);

CREATE TABLE IF NOT EXISTS public.continuity_agent_charters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.continuity_workspaces (id) ON DELETE CASCADE,
  display_code text NOT NULL,
  agent_name text NOT NULL,
  agent_type text,
  principal_label text,
  principal_external_ref text,
  owner_label text,
  owner_external_ref text,
  status public.continuity_agent_charter_status NOT NULL DEFAULT 'draft',
  allowed_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  prohibited_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_access_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  spending_limit numeric(18,2),
  contract_authority_limit text,
  requires_human_approval boolean NOT NULL DEFAULT true,
  approval_thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, display_code)
);

CREATE INDEX idx_continuity_agent_charters_workspace
  ON public.continuity_agent_charters (workspace_id, created_at DESC);

CREATE TRIGGER continuity_agent_charters_updated_at
  BEFORE UPDATE ON public.continuity_agent_charters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.continuity_signal_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.continuity_workspaces (id) ON DELETE CASCADE,
  source_system text NOT NULL,
  destination_system text NOT NULL DEFAULT 'r2chart_continuity',
  signal_type text NOT NULL DEFAULT 'context_feed',
  throughput_score integer NOT NULL DEFAULT 0 CHECK (throughput_score >= 0 AND throughput_score <= 100),
  integrity_score integer NOT NULL DEFAULT 0 CHECK (integrity_score >= 0 AND integrity_score <= 100),
  integrity_band public.continuity_confidence_band NOT NULL DEFAULT 'mid',
  state public.continuity_signal_channel_state NOT NULL DEFAULT 'planned',
  last_handshake_at timestamptz,
  last_ingest_run_id uuid,
  policy_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source_system, destination_system, signal_type)
);

CREATE TRIGGER continuity_signal_channels_updated_at
  BEFORE UPDATE ON public.continuity_signal_channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_continuity_signal_channels_workspace
  ON public.continuity_signal_channels (workspace_id);

CREATE TABLE IF NOT EXISTS public.continuity_governance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.continuity_workspaces (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  subject_type text,
  subject_id uuid,
  actor_type text NOT NULL DEFAULT 'user',
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  actor_agent_charter_id uuid REFERENCES public.continuity_agent_charters (id) ON DELETE SET NULL,
  actor_label text,
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_hash text,
  audit_hash text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_continuity_governance_events_workspace_created
  ON public.continuity_governance_events (workspace_id, created_at DESC);

-- Friction + underwriting (minimal scaffold for cockpit read models)
CREATE TABLE IF NOT EXISTS public.continuity_friction_surfaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.continuity_workspaces (id) ON DELETE CASCADE,
  target_label text,
  target_external_ref text,
  industry text,
  workflow text NOT NULL,
  revenue_pool text,
  human_friction_type text,
  agent_vector text,
  agent_capability_required text,
  current_agent_readiness text,
  friction_dependency_score numeric(5,2),
  compression_probability numeric(5,2),
  time_horizon text,
  regulatory_brakes text,
  defensible_context_assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  exposure_score integer NOT NULL DEFAULT 0 CHECK (exposure_score >= 0 AND exposure_score <= 100),
  trend text NOT NULL DEFAULT 'stable',
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER continuity_friction_surfaces_updated_at
  BEFORE UPDATE ON public.continuity_friction_surfaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_continuity_friction_workspace
  ON public.continuity_friction_surfaces (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.continuity_underwriting_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.continuity_workspaces (id) ON DELETE CASCADE,
  target_type text NOT NULL DEFAULT 'institution',
  target_label text,
  target_external_ref text,
  score numeric(6,2),
  score_band text,
  summary text,
  risk_level text,
  component_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommended_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_asset_recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  agent_authority_risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  friction_risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  oracle_opportunity_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'completed',
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_continuity_underwriting_workspace
  ON public.continuity_underwriting_runs (workspace_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.continuity_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continuity_context_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continuity_context_asset_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continuity_evidence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continuity_agent_charters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continuity_signal_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continuity_governance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continuity_friction_surfaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continuity_underwriting_runs ENABLE ROW LEVEL SECURITY;

-- Optional demo read path: anon may SELECT the seeded default workspace only (narrow with Supabase Dashboard if needed).
CREATE POLICY continuity_workspaces_select_anon_demo
  ON public.continuity_workspaces FOR SELECT TO anon
  USING (id = '11111111-1111-4111-8111-111111111111');

CREATE POLICY continuity_context_assets_select_anon_demo
  ON public.continuity_context_assets FOR SELECT TO anon
  USING (workspace_id = '11111111-1111-4111-8111-111111111111');

CREATE POLICY continuity_context_asset_entities_select_anon_demo
  ON public.continuity_context_asset_entities FOR SELECT TO anon
  USING (workspace_id = '11111111-1111-4111-8111-111111111111');

CREATE POLICY continuity_evidence_links_select_anon_demo
  ON public.continuity_evidence_links FOR SELECT TO anon
  USING (workspace_id = '11111111-1111-4111-8111-111111111111');

CREATE POLICY continuity_agent_charters_select_anon_demo
  ON public.continuity_agent_charters FOR SELECT TO anon
  USING (workspace_id = '11111111-1111-4111-8111-111111111111');

CREATE POLICY continuity_signal_channels_select_anon_demo
  ON public.continuity_signal_channels FOR SELECT TO anon
  USING (workspace_id = '11111111-1111-4111-8111-111111111111');

CREATE POLICY continuity_governance_events_select_anon_demo
  ON public.continuity_governance_events FOR SELECT TO anon
  USING (workspace_id = '11111111-1111-4111-8111-111111111111');

CREATE POLICY continuity_friction_select_anon_demo
  ON public.continuity_friction_surfaces FOR SELECT TO anon
  USING (workspace_id = '11111111-1111-4111-8111-111111111111');

CREATE POLICY continuity_underwriting_select_anon_demo
  ON public.continuity_underwriting_runs FOR SELECT TO anon
  USING (workspace_id = '11111111-1111-4111-8111-111111111111');

-- Authenticated read-all within MVP single-tenant posture
CREATE POLICY continuity_workspaces_select_authenticated
  ON public.continuity_workspaces FOR SELECT TO authenticated
  USING (true);

CREATE POLICY continuity_context_assets_select_authenticated
  ON public.continuity_context_assets FOR SELECT TO authenticated
  USING (true);

CREATE POLICY continuity_context_assets_insert_own
  ON public.continuity_context_assets FOR INSERT TO authenticated
  WITH CHECK (created_by IS NOT NULL AND created_by = auth.uid());

CREATE POLICY continuity_context_assets_update_own_or_admin
  ON public.continuity_context_assets FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.continuity_is_admin())
  WITH CHECK (created_by = auth.uid() OR public.continuity_is_admin());

CREATE POLICY continuity_context_assets_delete_admin
  ON public.continuity_context_assets FOR DELETE TO authenticated
  USING (public.continuity_is_admin());

CREATE POLICY continuity_context_asset_entities_select_authenticated
  ON public.continuity_context_asset_entities FOR SELECT TO authenticated
  USING (true);

CREATE POLICY continuity_context_asset_entities_insert_own
  ON public.continuity_context_asset_entities FOR INSERT TO authenticated
  WITH CHECK (created_by IS NOT NULL AND created_by = auth.uid());

CREATE POLICY continuity_context_asset_entities_update_own_or_admin
  ON public.continuity_context_asset_entities FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.continuity_is_admin())
  WITH CHECK (created_by = auth.uid() OR public.continuity_is_admin());

CREATE POLICY continuity_context_asset_entities_delete_admin
  ON public.continuity_context_asset_entities FOR DELETE TO authenticated
  USING (public.continuity_is_admin());

CREATE POLICY continuity_evidence_links_select_authenticated
  ON public.continuity_evidence_links FOR SELECT TO authenticated
  USING (true);

CREATE POLICY continuity_evidence_links_insert_own
  ON public.continuity_evidence_links FOR INSERT TO authenticated
  WITH CHECK (created_by IS NOT NULL AND created_by = auth.uid());

CREATE POLICY continuity_evidence_links_update_own_or_admin
  ON public.continuity_evidence_links FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.continuity_is_admin())
  WITH CHECK (created_by = auth.uid() OR public.continuity_is_admin());

CREATE POLICY continuity_evidence_links_delete_admin
  ON public.continuity_evidence_links FOR DELETE TO authenticated
  USING (public.continuity_is_admin());

CREATE POLICY continuity_agent_charters_select_authenticated
  ON public.continuity_agent_charters FOR SELECT TO authenticated
  USING (true);

CREATE POLICY continuity_agent_charters_insert_own
  ON public.continuity_agent_charters FOR INSERT TO authenticated
  WITH CHECK (created_by IS NOT NULL AND created_by = auth.uid());

CREATE POLICY continuity_agent_charters_update_own_or_admin
  ON public.continuity_agent_charters FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.continuity_is_admin())
  WITH CHECK (created_by = auth.uid() OR public.continuity_is_admin());

CREATE POLICY continuity_agent_charters_delete_admin
  ON public.continuity_agent_charters FOR DELETE TO authenticated
  USING (public.continuity_is_admin());

CREATE POLICY continuity_signal_channels_select_authenticated
  ON public.continuity_signal_channels FOR SELECT TO authenticated
  USING (true);

CREATE POLICY continuity_signal_channels_insert_own
  ON public.continuity_signal_channels FOR INSERT TO authenticated
  WITH CHECK (created_by IS NOT NULL AND created_by = auth.uid());

CREATE POLICY continuity_signal_channels_update_own_or_admin
  ON public.continuity_signal_channels FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.continuity_is_admin())
  WITH CHECK (created_by = auth.uid() OR public.continuity_is_admin());

CREATE POLICY continuity_signal_channels_delete_admin
  ON public.continuity_signal_channels FOR DELETE TO authenticated
  USING (public.continuity_is_admin());

CREATE POLICY continuity_governance_events_select_authenticated
  ON public.continuity_governance_events FOR SELECT TO authenticated
  USING (true);

CREATE POLICY continuity_governance_events_insert_actor
  ON public.continuity_governance_events FOR INSERT TO authenticated
  WITH CHECK (
    (actor_user_id IS NOT NULL AND actor_user_id = auth.uid())
    OR public.continuity_is_admin()
  );

CREATE POLICY continuity_governance_events_update_admin
  ON public.continuity_governance_events FOR UPDATE TO authenticated
  USING (public.continuity_is_admin())
  WITH CHECK (public.continuity_is_admin());

CREATE POLICY continuity_governance_events_delete_admin
  ON public.continuity_governance_events FOR DELETE TO authenticated
  USING (public.continuity_is_admin());

CREATE POLICY continuity_friction_select_authenticated
  ON public.continuity_friction_surfaces FOR SELECT TO authenticated
  USING (true);

CREATE POLICY continuity_friction_insert_own
  ON public.continuity_friction_surfaces FOR INSERT TO authenticated
  WITH CHECK (created_by IS NOT NULL AND created_by = auth.uid());

CREATE POLICY continuity_friction_update_own_or_admin
  ON public.continuity_friction_surfaces FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.continuity_is_admin())
  WITH CHECK (created_by = auth.uid() OR public.continuity_is_admin());

CREATE POLICY continuity_friction_delete_admin
  ON public.continuity_friction_surfaces FOR DELETE TO authenticated
  USING (public.continuity_is_admin());

CREATE POLICY continuity_underwriting_select_authenticated
  ON public.continuity_underwriting_runs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY continuity_underwriting_insert_own
  ON public.continuity_underwriting_runs FOR INSERT TO authenticated
  WITH CHECK (created_by IS NOT NULL AND created_by = auth.uid());

CREATE POLICY continuity_underwriting_update_own_or_admin
  ON public.continuity_underwriting_runs FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.continuity_is_admin())
  WITH CHECK (created_by = auth.uid() OR public.continuity_is_admin());

CREATE POLICY continuity_underwriting_delete_admin
  ON public.continuity_underwriting_runs FOR DELETE TO authenticated
  USING (public.continuity_is_admin());

-- ---------------------------------------------------------------------------
-- Read-model views (security invoker — respect RLS on base tables)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_context_assets_registry
WITH (security_invoker = true) AS
SELECT
  ca.*,
  coalesce(ev.cnt, 0)::integer AS evidence_link_count,
  coalesce(ev.contradictions, 0)::integer AS contradiction_link_count
FROM public.continuity_context_assets ca
LEFT JOIN (
  SELECT
    context_asset_id,
    count(*)::integer AS cnt,
    count(*) FILTER (WHERE contradiction_state IS DISTINCT FROM 'none')::integer AS contradictions
  FROM public.continuity_evidence_links
  WHERE context_asset_id IS NOT NULL
  GROUP BY context_asset_id
) ev ON ev.context_asset_id = ca.id;

CREATE OR REPLACE VIEW public.v_evidence_integrity_rail
WITH (security_invoker = true) AS
SELECT
  el.id,
  el.workspace_id,
  el.context_asset_id,
  ca.display_code AS asset_display_code,
  el.missing_proof_item,
  el.provenance_status,
  el.contradiction_state,
  el.freshness_band,
  el.source_authority,
  el.review_posture,
  el.evidence_summary,
  el.created_at
FROM public.continuity_evidence_links el
LEFT JOIN public.continuity_context_assets ca ON ca.id = el.context_asset_id
WHERE el.missing_proof_item IS NOT NULL
   OR el.review_posture IN ('human_gated', 'blocked');

CREATE OR REPLACE VIEW public.v_signal_channel_map
WITH (security_invoker = true) AS
SELECT
  sc.*,
  coalesce(sc.metadata ->> 'channel_label', sc.signal_type) AS channel_label,
  coalesce(sc.metadata ->> 'from_custodian', sc.source_system) AS from_custodian,
  coalesce(sc.metadata ->> 'to_custodian', sc.destination_system) AS to_custodian
FROM public.continuity_signal_channels sc;

CREATE OR REPLACE VIEW public.v_governance_timeline
WITH (security_invoker = true) AS
SELECT
  ge.id,
  ge.workspace_id,
  ge.created_at AS ts,
  coalesce(ge.payload ->> 'band', 'policy') AS band,
  coalesce(ge.payload ->> 'headline', ge.summary) AS headline,
  coalesce(ge.payload ->> 'detail', ge.summary) AS detail,
  coalesce(ge.actor_label, ge.actor_type) AS actor,
  ge.severity,
  ge.event_type,
  ge.audit_hash,
  ge.previous_hash
FROM public.continuity_governance_events ge;

CREATE OR REPLACE VIEW public.v_agent_authority_surface
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.workspace_id,
  c.display_code,
  c.agent_name,
  c.agent_type,
  c.status,
  c.allowed_actions,
  c.prohibited_actions,
  c.requires_human_approval,
  c.revoked_at,
  (c.status = 'revoked' OR c.revoked_at IS NOT NULL) AS is_revoked,
  c.created_at,
  c.updated_at,
  coalesce(c.metadata ->> 'scope_summary', '') AS scope_summary,
  coalesce(c.metadata ->> 'authority_level', 'observe') AS authority_level
FROM public.continuity_agent_charters c;

CREATE OR REPLACE VIEW public.v_friction_collapse_watchlist
WITH (security_invoker = true) AS
SELECT *
FROM public.continuity_friction_surfaces;

CREATE OR REPLACE VIEW public.v_underwriting_history
WITH (security_invoker = true) AS
SELECT *
FROM public.continuity_underwriting_runs;

CREATE OR REPLACE VIEW public.v_continuity_dashboard_summary
WITH (security_invoker = true) AS
SELECT
  w.id AS workspace_id,
  (SELECT count(*) FROM public.continuity_context_assets ca WHERE ca.workspace_id = w.id) AS context_asset_count,
  (SELECT count(*) FROM public.continuity_agent_charters ac WHERE ac.workspace_id = w.id AND ac.status <> 'revoked') AS active_charter_count,
  (SELECT count(*) FROM public.continuity_evidence_links el WHERE el.workspace_id = w.id) AS evidence_link_count,
  (SELECT count(*) FROM public.continuity_signal_channels ch WHERE ch.workspace_id = w.id AND ch.state = 'live') AS live_channel_count,
  (SELECT count(*) FROM public.continuity_governance_events ge WHERE ge.workspace_id = w.id) AS governance_event_count,
  (SELECT count(*) FROM public.continuity_friction_surfaces f WHERE f.workspace_id = w.id) AS friction_surface_count
FROM public.continuity_workspaces w;

-- ---------------------------------------------------------------------------
-- Seed (deterministic workspace id for local + docs)
-- ---------------------------------------------------------------------------

INSERT INTO public.continuity_workspaces (id, name, slug)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'R2Chart Continuity · Default',
  'default'
)
ON CONFLICT (id) DO NOTHING;

-- Seed rows use platform/service identity — no auth.users FK for created_by (nullable allowed).
INSERT INTO public.continuity_context_assets (
  workspace_id, display_code, title, description, context_type,
  custodian_label, source_system, ai_access_policy, governance_status,
  confidence_band, contradiction_open_count, metadata
) VALUES
('11111111-1111-4111-8111-111111111111', 'CA-2030-0001', 'R. Halverson — Operator Profile', NULL, 'relationship_memory',
 'R2 Works', 'meg', 'summaries_only', 'active', 'high', 1, '{"kind":"person"}'::jsonb),
('11111111-1111-4111-8111-111111111111', 'CA-2030-0002', 'Hawthorn Property Trust', NULL, 'asset_context',
 'CentralR2', 'centralr2', 'summaries_only', 'active', 'high', 0, '{"kind":"institution"}'::jsonb),
('11111111-1111-4111-8111-111111111111', 'CA-2030-0003', 'SmartPLRx — GLP-1 Cohort 14', NULL, 'regulatory_context',
 'SmartPLRx', 'smartplrx', 'sealed', 'under_review', 'mid', 3, '{"kind":"asset"}'::jsonb),
('11111111-1111-4111-8111-111111111111', 'CA-2030-0004', 'Ray''s Retreat — Spring Convening', NULL, 'event_context',
 'Ray''s Retreat', 'rays_retreat', 'public_safe', 'active', 'high', 0, '{"kind":"event"}'::jsonb),
('11111111-1111-4111-8111-111111111111', 'CA-2030-0005', 'Eigen Memory — Operator Threadset 09', NULL, 'institutional_memory',
 'EigenX', 'eigen', 'summaries_only', 'active', 'low', 5, '{"kind":"community"}'::jsonb),
('11111111-1111-4111-8111-111111111111', 'CA-2030-0006', 'HP Tools — Closing Pack 2030-Q2', NULL, 'asset_context',
 'HP Tools', 'hp_tools', 'summaries_only', 'active', 'high', 0, '{"kind":"asset"}'::jsonb)
ON CONFLICT (workspace_id, display_code) DO NOTHING;

INSERT INTO public.continuity_agent_charters (
  workspace_id, display_code, agent_name, agent_type, status,
  allowed_actions, requires_human_approval, revoked_at, metadata
) VALUES
('11111111-1111-4111-8111-111111111111', 'CHTR-A1', 'Oracle Drafting Agent', 'whitespace', 'active',
 '["read_context","summarize_context","draft_recommendation"]'::jsonb, true, NULL,
 '{"scope_summary":"Whitespace synthesis, read-only","authority_level":"propose"}'::jsonb),
('11111111-1111-4111-8111-111111111111', 'CHTR-A2', 'MEG Resolver', 'identity', 'active',
 '["read_context","summarize_context"]'::jsonb, true, NULL,
 '{"scope_summary":"Identity reconciliation across sources","authority_level":"act"}'::jsonb),
('11111111-1111-4111-8111-111111111111', 'CHTR-A3', 'HP Closing Agent', 'workflow', 'active',
 '["read_context","draft_recommendation","commit_transaction"]'::jsonb, true, NULL,
 '{"scope_summary":"Document assembly under operator review","authority_level":"commit"}'::jsonb),
('11111111-1111-4111-8111-111111111111', 'CHTR-A4', 'SmartPLRx Watch', 'observation', 'active',
 '["read_context"]'::jsonb, false, NULL,
 '{"scope_summary":"Regulatory feed observation","authority_level":"observe"}'::jsonb),
('11111111-1111-4111-8111-111111111111', 'CHTR-A5', 'Legacy CRM Bridge', 'integration', 'revoked',
 '["read_context"]'::jsonb, false, now(),
 '{"scope_summary":"Deprecated outbound writes","authority_level":"act"}'::jsonb)
ON CONFLICT (workspace_id, display_code) DO NOTHING;

INSERT INTO public.continuity_friction_surfaces (
  workspace_id, workflow, industry, exposure_score, revenue_pool, trend, agent_vector, metadata
) VALUES
('11111111-1111-4111-8111-111111111111', 'Title curative review', 'Real estate closings', 84, '$3.2B', 'collapsing', 'Autonomous doc agents', '{}'::jsonb),
('11111111-1111-4111-8111-111111111111', 'Cohort eligibility screening', 'Pharma trials', 71, '$1.1B', 'rising', 'Multi-source resolvers', '{}'::jsonb),
('11111111-1111-4111-8111-111111111111', 'Operator intro brokering', 'Private capital', 46, '$640M', 'stable', 'Memory-graph agents', '{}'::jsonb),
('11111111-1111-4111-8111-111111111111', 'Convening recap synthesis', 'Retreats & summits', 38, '$120M', 'rising', 'Conversational memory', '{}'::jsonb);

INSERT INTO public.continuity_underwriting_runs (
  workspace_id, target_type, target_label, score, score_band, summary, risk_level, status,
  component_scores, completed_at
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'institution',
  'R2 Institutional Portfolio',
  78.4,
  'Stable',
  'Composite continuity posture — governance-grade cockpit seed.',
  'moderate',
  'completed',
  '{"context_depth":82,"evidence_integrity":71,"relationship_durability":75,"agent_readiness":64,"friction_resilience":58,"governance_maturity":88}'::jsonb,
  now()
);

-- Evidence links + governance events reference assets by display_code lookup subquery would be heavy — use stable ids from insert
WITH assets AS (
  SELECT id, display_code FROM public.continuity_context_assets
  WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
)
INSERT INTO public.continuity_evidence_links (
  workspace_id, context_asset_id, source_system, evidence_summary,
  provenance_status, source_authority, freshness_band, contradiction_state, review_posture, missing_proof_item
)
SELECT
  '11111111-1111-4111-8111-111111111111',
  a.id,
  v.source_system,
  v.evidence_summary,
  v.provenance_status,
  v.source_authority,
  v.freshness_band,
  v.contradiction_state,
  v.review_posture,
  v.missing_proof_item
FROM assets a
JOIN (VALUES
  ('CA-2030-0005', 'eigen', 'Eigen thread 09 references unresolved identity ''M. Park''', 'unsigned', 'inferred', 'stale', 'multi', 'human_gated', 'Identity resolution for ''M. Park'''),
  ('CA-2030-0003', 'smartplrx', 'Cohort 14 endpoint shifted from 12w to 16w', 'partial', 'primary', 'aging', 'single', 'blocked', 'Endpoint change attestation'),
  ('CA-2030-0006', 'hp_tools', 'Closing pack countersignature pending', 'partial', 'secondary', 'fresh', 'none', 'human_gated', 'Counterparty signature provenance'),
  ('CA-2030-0001', 'r2_works', 'Custodian R2 Works confirmed operator availability Q3 2030', 'signed', 'primary', 'aging', 'none', 'auto', 'Custodian re-attestation overdue')
) AS v(display_code, source_system, evidence_summary, provenance_status, source_authority, freshness_band, contradiction_state, review_posture, missing_proof_item)
  ON a.display_code = v.display_code;

-- Fix ON CONFLICT - evidence_links has no unique constraint for upsert; plain INSERT may duplicate on re-run.
-- Use NOT EXISTS guard via delete-first pattern is bad. Add partial unique? Skip — migration runs once.

INSERT INTO public.continuity_signal_channels (
  workspace_id, source_system, destination_system, signal_type,
  throughput_score, integrity_score, integrity_band, state, metadata, created_by
)
VALUES
('11111111-1111-4111-8111-111111111111', 'rays_retreat', 'r2chart_continuity', 'convening_context', 71, 82, 'high', 'live',
 '{"channel_label":"convening · attendee context","from_custodian":"Ray''s Retreat","to_custodian":"R2Chart Continuity"}'::jsonb, NULL),
('11111111-1111-4111-8111-111111111111', 'oracle_white_space', 'r2chart_continuity', 'whitespace_thesis', 44, 55, 'mid', 'live',
 '{"channel_label":"whitespace · drafted theses","from_custodian":"Oracle / White Space","to_custodian":"R2Chart Continuity"}'::jsonb, NULL),
('11111111-1111-4111-8111-111111111111', 'meg', 'r2chart_continuity', 'identity_resolution', 88, 90, 'high', 'live',
 '{"channel_label":"identity · resolved subjects","from_custodian":"MEG","to_custodian":"R2Chart Continuity"}'::jsonb, NULL),
('11111111-1111-4111-8111-111111111111', 'eigen', 'r2chart_continuity', 'memory_threads', 33, 35, 'low', 'degraded',
 '{"channel_label":"memory · operator threads","from_custodian":"Eigen / EigenX","to_custodian":"R2Chart Continuity"}'::jsonb, NULL),
('11111111-1111-4111-8111-111111111111', 'r2_works', 'r2chart_continuity', 'operator_attestation', 62, 85, 'high', 'live',
 '{"channel_label":"review · operator attestations","from_custodian":"R2 Works","to_custodian":"R2Chart Continuity"}'::jsonb, NULL),
('11111111-1111-4111-8111-111111111111', 'centralr2', 'r2chart_continuity', 'real_estate_context', 57, 58, 'mid', 'degraded',
 '{"channel_label":"real-estate · asset context","from_custodian":"CentralR2","to_custodian":"R2Chart Continuity"}'::jsonb, NULL),
('11111111-1111-4111-8111-111111111111', 'smartplrx', 'r2chart_continuity', 'regulatory_cohort', 0, 55, 'mid', 'planned',
 '{"channel_label":"regulatory · cohort signal","from_custodian":"SmartPLRx","to_custodian":"R2Chart Continuity"}'::jsonb, NULL),
('11111111-1111-4111-8111-111111111111', 'hp_tools', 'r2chart_continuity', 'closing_evidence', 0, 40, 'low', 'sealed',
 '{"channel_label":"closing · workflow evidence","from_custodian":"HP Tools","to_custodian":"R2Chart Continuity"}'::jsonb, NULL),
('11111111-1111-4111-8111-111111111111', 'meg', 'r2_works', 'identity_resolution', 88, 90, 'high', 'live',
 '{"channel_label":"identity-resolution","from_custodian":"MEG","to_custodian":"R2 Works"}'::jsonb, NULL),
('11111111-1111-4111-8111-111111111111', 'rays_retreat', 'eigen', 'convening_memory', 64, 82, 'high', 'live',
 '{"channel_label":"convening-memory","from_custodian":"Ray''s Retreat","to_custodian":"Eigen / EigenX"}'::jsonb, NULL),
('11111111-1111-4111-8111-111111111111', 'centralr2', 'hp_tools', 'closing_evidence', 72, 58, 'mid', 'degraded',
 '{"channel_label":"closing-evidence","from_custodian":"CentralR2","to_custodian":"HP Tools"}'::jsonb, NULL),
('11111111-1111-4111-8111-111111111111', 'oracle_white_space', 'r2_works', 'whitespace_thesis', 22, 55, 'mid', 'planned',
 '{"channel_label":"whitespace-thesis","from_custodian":"Oracle / White Space","to_custodian":"R2 Works"}'::jsonb, NULL)
ON CONFLICT (workspace_id, source_system, destination_system, signal_type) DO NOTHING;

INSERT INTO public.continuity_governance_events (
  workspace_id, event_type, subject_type, summary, severity, actor_type, actor_label, payload, previous_hash, audit_hash
) VALUES
(
  '11111111-1111-4111-8111-111111111111',
  'agent_action_logged',
  'context_asset',
  'MEG Resolver merged identity cluster',
  'info',
  'agent',
  'agent:meg-resolver',
  '{"band":"agent","headline":"MEG Resolver merged identity cluster","detail":"Operator Halverson reconciled across 3 custodians under CHTR-A2 authority."}'::jsonb,
  NULL,
  encode(sha256(convert_to('genesis:agent_action_logged','UTF8')),'hex')
),
(
  '11111111-1111-4111-8111-111111111111',
  'agent_charter_updated',
  'agent_charter',
  'Operator-12 approved Oracle Drafting charter',
  'info',
  'human',
  'human:operator-12',
  '{"band":"charter","headline":"Operator-12 approved Oracle Drafting charter","detail":"CHTR-A1 promoted from observe → propose with human review gate retained."}'::jsonb,
  encode(sha256(convert_to('genesis:agent_action_logged','UTF8')),'hex'),
  encode(sha256(convert_to('chain:1:agent_charter_updated','UTF8')),'hex')
),
(
  '11111111-1111-4111-8111-111111111111',
  'oracle_opportunity_routed',
  'opportunity',
  'Whitespace WS-2030-117 entered review',
  'info',
  'agent',
  'agent:oracle-drafting',
  '{"band":"evidence","headline":"Whitespace WS-2030-117 entered review","detail":"Drafted by autonomous agent; awaiting custodian counter-signature."}'::jsonb,
  encode(sha256(convert_to('chain:1:agent_charter_updated','UTF8')),'hex'),
  encode(sha256(convert_to('chain:2:oracle_opportunity_routed','UTF8')),'hex')
),
(
  '11111111-1111-4111-8111-111111111111',
  'manual_review_completed',
  'context_asset',
  'Contradiction flagged on cohort endpoint',
  'warn',
  'agent',
  'agent:smartplrx-watch',
  '{"band":"evidence","headline":"Contradiction flagged on cohort endpoint","detail":"SmartPLRx Cohort 14 endpoint shift — 12w → 16w — lacks attestation."}'::jsonb,
  encode(sha256(convert_to('chain:2:oracle_opportunity_routed','UTF8')),'hex'),
  encode(sha256(convert_to('chain:3:manual_review_completed','UTF8')),'hex')
),
(
  '11111111-1111-4111-8111-111111111111',
  'context_asset_sealed',
  'context_asset',
  'Custodian sealed CA-2030-0003',
  'warn',
  'human',
  'human:custodian-04',
  '{"band":"policy","headline":"Custodian sealed CA-2030-0003","detail":"Asset moved to sealed policy band pending regulatory clarification."}'::jsonb,
  encode(sha256(convert_to('chain:3:manual_review_completed','UTF8')),'hex'),
  encode(sha256(convert_to('chain:4:context_asset_sealed','UTF8')),'hex')
),
(
  '11111111-1111-4111-8111-111111111111',
  'friction_surface_created',
  'friction_surface',
  'Friction collapse threshold crossed',
  'critical',
  'system',
  'system:friction-scanner',
  '{"band":"friction","headline":"Friction collapse threshold crossed","detail":"Title curative review exposure crossed 80% — autonomous closing imminent."}'::jsonb,
  encode(sha256(convert_to('chain:4:context_asset_sealed','UTF8')),'hex'),
  encode(sha256(convert_to('chain:5:friction_surface_created','UTF8')),'hex')
);

-- ---------------------------------------------------------------------------
-- Grants: views + tables for authenticated API role
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.continuity_is_admin() TO authenticated;

GRANT SELECT ON public.continuity_workspaces TO anon;
GRANT SELECT ON public.continuity_context_assets TO anon;
GRANT SELECT ON public.continuity_context_asset_entities TO anon;
GRANT SELECT ON public.continuity_evidence_links TO anon;
GRANT SELECT ON public.continuity_agent_charters TO anon;
GRANT SELECT ON public.continuity_signal_channels TO anon;
GRANT SELECT ON public.continuity_governance_events TO anon;
GRANT SELECT ON public.continuity_friction_surfaces TO anon;
GRANT SELECT ON public.continuity_underwriting_runs TO anon;

GRANT SELECT ON public.continuity_workspaces TO authenticated;
GRANT SELECT ON public.continuity_context_assets TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.continuity_context_assets TO authenticated;
GRANT SELECT ON public.continuity_context_asset_entities TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.continuity_context_asset_entities TO authenticated;
GRANT SELECT ON public.continuity_evidence_links TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.continuity_evidence_links TO authenticated;
GRANT SELECT ON public.continuity_agent_charters TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.continuity_agent_charters TO authenticated;
GRANT SELECT ON public.continuity_signal_channels TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.continuity_signal_channels TO authenticated;
GRANT SELECT ON public.continuity_governance_events TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.continuity_governance_events TO authenticated;
GRANT SELECT ON public.continuity_friction_surfaces TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.continuity_friction_surfaces TO authenticated;
GRANT SELECT ON public.continuity_underwriting_runs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.continuity_underwriting_runs TO authenticated;

GRANT SELECT ON public.v_context_assets_registry TO authenticated;
GRANT SELECT ON public.v_evidence_integrity_rail TO authenticated;
GRANT SELECT ON public.v_signal_channel_map TO authenticated;
GRANT SELECT ON public.v_governance_timeline TO authenticated;
GRANT SELECT ON public.v_agent_authority_surface TO authenticated;
GRANT SELECT ON public.v_friction_collapse_watchlist TO authenticated;
GRANT SELECT ON public.v_underwriting_history TO authenticated;
GRANT SELECT ON public.v_continuity_dashboard_summary TO authenticated;

GRANT SELECT ON public.v_context_assets_registry TO anon;
GRANT SELECT ON public.v_evidence_integrity_rail TO anon;
GRANT SELECT ON public.v_signal_channel_map TO anon;
GRANT SELECT ON public.v_governance_timeline TO anon;
GRANT SELECT ON public.v_agent_authority_surface TO anon;
GRANT SELECT ON public.v_friction_collapse_watchlist TO anon;
GRANT SELECT ON public.v_underwriting_history TO anon;
GRANT SELECT ON public.v_continuity_dashboard_summary TO anon;

GRANT ALL ON public.continuity_workspaces TO service_role;
GRANT ALL ON public.continuity_context_assets TO service_role;
GRANT ALL ON public.continuity_context_asset_entities TO service_role;
GRANT ALL ON public.continuity_evidence_links TO service_role;
GRANT ALL ON public.continuity_agent_charters TO service_role;
GRANT ALL ON public.continuity_signal_channels TO service_role;
GRANT ALL ON public.continuity_governance_events TO service_role;
GRANT ALL ON public.continuity_friction_surfaces TO service_role;
GRANT ALL ON public.continuity_underwriting_runs TO service_role;
GRANT ALL ON public.v_context_assets_registry TO service_role;
GRANT ALL ON public.v_evidence_integrity_rail TO service_role;
GRANT ALL ON public.v_signal_channel_map TO service_role;
GRANT ALL ON public.v_governance_timeline TO service_role;
GRANT ALL ON public.v_agent_authority_surface TO service_role;
GRANT ALL ON public.v_friction_collapse_watchlist TO service_role;
GRANT ALL ON public.v_underwriting_history TO service_role;
GRANT ALL ON public.v_continuity_dashboard_summary TO service_role;
