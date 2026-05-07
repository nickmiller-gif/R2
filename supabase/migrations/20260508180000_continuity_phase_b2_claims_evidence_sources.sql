-- R2Chart Continuity — Phase B.2: governed claims + evidence source registry
-- See continuity-nexus/docs/CONTINUITY-BACKEND-PLAN.md § Phase B.
-- Apply from an R2 checkout against the shared Eigen project (`supabase db push`).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.continuity_evidence_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.continuity_workspaces (id) ON DELETE CASCADE,
  display_label text NOT NULL,
  source_system text NOT NULL,
  authority_tier text NOT NULL DEFAULT 'secondary'
    CHECK (authority_tier IN ('primary', 'secondary', 'inferred', 'unknown')),
  base_uri text,
  custodian_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_continuity_evidence_sources_workspace
  ON public.continuity_evidence_sources (workspace_id, created_at DESC);

CREATE TRIGGER continuity_evidence_sources_updated_at
  BEFORE UPDATE ON public.continuity_evidence_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.continuity_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.continuity_workspaces (id) ON DELETE CASCADE,
  context_asset_id uuid REFERENCES public.continuity_context_assets (id) ON DELETE SET NULL,
  signal_item_id uuid REFERENCES public.continuity_signal_items (id) ON DELETE SET NULL,
  statement text NOT NULL CHECK (btrim(statement) <> ''),
  claim_type text NOT NULL DEFAULT 'operational',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft', 'open', 'substantiated', 'disputed', 'withdrawn')),
  confidence numeric(5,2),
  sensitivity_level text NOT NULL DEFAULT 'internal',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_continuity_claims_workspace_created
  ON public.continuity_claims (workspace_id, created_at DESC);

CREATE INDEX idx_continuity_claims_context_asset
  ON public.continuity_claims (context_asset_id)
  WHERE context_asset_id IS NOT NULL;

CREATE INDEX idx_continuity_claims_signal_item
  ON public.continuity_claims (signal_item_id)
  WHERE signal_item_id IS NOT NULL;

CREATE TRIGGER continuity_claims_updated_at
  BEFORE UPDATE ON public.continuity_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Evidence links already carry nullable claim_id — enforce referential integrity.
ALTER TABLE public.continuity_evidence_links
  DROP CONSTRAINT IF EXISTS continuity_evidence_links_claim_id_fkey;

ALTER TABLE public.continuity_evidence_links
  ADD CONSTRAINT continuity_evidence_links_claim_id_fkey
  FOREIGN KEY (claim_id) REFERENCES public.continuity_claims (id) ON DELETE SET NULL;

ALTER TABLE public.continuity_evidence_links
  ADD COLUMN IF NOT EXISTS evidence_source_id uuid REFERENCES public.continuity_evidence_sources (id) ON DELETE SET NULL;

CREATE INDEX idx_continuity_evidence_links_claim
  ON public.continuity_evidence_links (claim_id)
  WHERE claim_id IS NOT NULL;

CREATE INDEX idx_continuity_evidence_links_evidence_source
  ON public.continuity_evidence_links (evidence_source_id)
  WHERE evidence_source_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.continuity_evidence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continuity_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY continuity_evidence_sources_select_anon_demo
  ON public.continuity_evidence_sources FOR SELECT TO anon
  USING (workspace_id = '11111111-1111-4111-8111-111111111111');

CREATE POLICY continuity_claims_select_anon_demo
  ON public.continuity_claims FOR SELECT TO anon
  USING (workspace_id = '11111111-1111-4111-8111-111111111111');

CREATE POLICY continuity_evidence_sources_select_authenticated
  ON public.continuity_evidence_sources FOR SELECT TO authenticated
  USING (true);

CREATE POLICY continuity_evidence_sources_insert_own
  ON public.continuity_evidence_sources FOR INSERT TO authenticated
  WITH CHECK (created_by IS NOT NULL AND created_by = auth.uid());

CREATE POLICY continuity_evidence_sources_update_own_or_admin
  ON public.continuity_evidence_sources FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.continuity_is_admin())
  WITH CHECK (created_by = auth.uid() OR public.continuity_is_admin());

CREATE POLICY continuity_evidence_sources_delete_admin
  ON public.continuity_evidence_sources FOR DELETE TO authenticated
  USING (public.continuity_is_admin());

CREATE POLICY continuity_claims_select_authenticated
  ON public.continuity_claims FOR SELECT TO authenticated
  USING (true);

CREATE POLICY continuity_claims_insert_own
  ON public.continuity_claims FOR INSERT TO authenticated
  WITH CHECK (created_by IS NOT NULL AND created_by = auth.uid());

CREATE POLICY continuity_claims_update_own_or_admin
  ON public.continuity_claims FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.continuity_is_admin())
  WITH CHECK (created_by = auth.uid() OR public.continuity_is_admin());

CREATE POLICY continuity_claims_delete_admin
  ON public.continuity_claims FOR DELETE TO authenticated
  USING (public.continuity_is_admin());

-- ---------------------------------------------------------------------------
-- Read-model views
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_continuity_claims_surface
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.workspace_id,
  c.statement,
  c.claim_type,
  c.status,
  c.confidence,
  c.sensitivity_level,
  c.context_asset_id,
  ca.display_code AS asset_display_code,
  c.signal_item_id,
  si.summary AS signal_summary,
  si.idempotency_key AS signal_idempotency_key,
  (
    SELECT count(*)::integer
    FROM public.continuity_evidence_links el
    WHERE el.claim_id = c.id
  ) AS evidence_link_count,
  c.metadata,
  c.created_at,
  c.updated_at
FROM public.continuity_claims c
LEFT JOIN public.continuity_context_assets ca ON ca.id = c.context_asset_id
LEFT JOIN public.continuity_signal_items si ON si.id = c.signal_item_id;

CREATE OR REPLACE VIEW public.v_context_assets_registry
WITH (security_invoker = true) AS
SELECT
  ca.*,
  coalesce(ev.cnt, 0)::integer AS evidence_link_count,
  coalesce(ev.contradictions, 0)::integer AS contradiction_link_count,
  coalesce(cl.claim_count, 0)::integer AS claim_count
FROM public.continuity_context_assets ca
LEFT JOIN (
  SELECT
    context_asset_id,
    count(*)::integer AS cnt,
    count(*) FILTER (WHERE contradiction_state IS DISTINCT FROM 'none')::integer AS contradictions
  FROM public.continuity_evidence_links
  WHERE context_asset_id IS NOT NULL
  GROUP BY context_asset_id
) ev ON ev.context_asset_id = ca.id
LEFT JOIN (
  SELECT
    context_asset_id,
    count(*)::integer AS claim_count
  FROM public.continuity_claims
  WHERE context_asset_id IS NOT NULL
  GROUP BY context_asset_id
) cl ON cl.context_asset_id = ca.id;

-- v_evidence_integrity_rail cannot use CREATE OR REPLACE when reordering columns vs Phase A.
-- Recreated in 20260508190000_continuity_phase_b2_view_recreate.sql (DROP + CREATE + grants).

CREATE OR REPLACE VIEW public.v_continuity_dashboard_summary
WITH (security_invoker = true) AS
SELECT
  w.id AS workspace_id,
  (SELECT count(*) FROM public.continuity_context_assets ca WHERE ca.workspace_id = w.id) AS context_asset_count,
  (SELECT count(*) FROM public.continuity_agent_charters ac WHERE ac.workspace_id = w.id AND ac.status <> 'revoked') AS active_charter_count,
  (SELECT count(*) FROM public.continuity_evidence_links el WHERE el.workspace_id = w.id) AS evidence_link_count,
  (SELECT count(*) FROM public.continuity_signal_channels ch WHERE ch.workspace_id = w.id AND ch.state = 'live') AS live_channel_count,
  (SELECT count(*) FROM public.continuity_governance_events ge WHERE ge.workspace_id = w.id) AS governance_event_count,
  (SELECT count(*) FROM public.continuity_friction_surfaces f WHERE f.workspace_id = w.id) AS friction_surface_count,
  (SELECT count(*) FROM public.continuity_signal_items si WHERE si.workspace_id = w.id) AS signal_item_count,
  (SELECT max(si.created_at) FROM public.continuity_signal_items si WHERE si.workspace_id = w.id) AS last_signal_item_at,
  (SELECT count(*) FROM public.continuity_claims c WHERE c.workspace_id = w.id) AS claim_count,
  (SELECT count(*) FROM public.continuity_evidence_sources s WHERE s.workspace_id = w.id) AS evidence_source_count
FROM public.continuity_workspaces w;

-- ---------------------------------------------------------------------------
-- Seed (demo workspace): one source, one claim tied to MEG signal + CA-2030-0001, wire one evidence link
-- ---------------------------------------------------------------------------

INSERT INTO public.continuity_evidence_sources (
  id,
  workspace_id,
  display_label,
  source_system,
  authority_tier,
  base_uri,
  metadata
)
VALUES (
  '33333333-3333-4333-8333-333333333331'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  'MEG · identity resolution custodian',
  'meg',
  'primary',
  NULL,
  '{"seed":true,"note":"Phase B.2 registry row"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.continuity_claims (
  id,
  workspace_id,
  context_asset_id,
  signal_item_id,
  statement,
  claim_type,
  status,
  confidence,
  sensitivity_level,
  metadata
)
VALUES (
  '33333333-3333-4333-8333-333333333332'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  (SELECT id FROM public.continuity_context_assets
   WHERE workspace_id = '11111111-1111-4111-8111-111111111111' AND display_code = 'CA-2030-0001'
   LIMIT 1),
  (SELECT id FROM public.continuity_signal_items
   WHERE workspace_id = '11111111-1111-4111-8111-111111111111' AND idempotency_key = 'seed:meg:identity_cluster_merged:v1'
   LIMIT 1),
  'Operator Halverson is the canonical identity across R2 Works, CentralR2, and Ray''s Retreat custodian records per MEG cluster merge.',
  'identity',
  'substantiated',
  0.91,
  'internal',
  '{"seed":true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.continuity_evidence_links el
SET
  claim_id = '33333333-3333-4333-8333-333333333332'::uuid,
  evidence_source_id = '33333333-3333-4333-8333-333333333331'::uuid
FROM public.continuity_context_assets ca
WHERE el.context_asset_id = ca.id
  AND ca.workspace_id = '11111111-1111-4111-8111-111111111111'
  AND ca.display_code = 'CA-2030-0001'
  AND el.source_system = 'r2_works'
  AND el.evidence_summary LIKE '%Custodian R2 Works confirmed operator availability%'
  AND EXISTS (
    SELECT 1 FROM public.continuity_claims c
    WHERE c.id = '33333333-3333-4333-8333-333333333332'::uuid
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT SELECT ON public.continuity_evidence_sources TO anon;
GRANT SELECT ON public.continuity_claims TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.continuity_evidence_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.continuity_claims TO authenticated;

GRANT ALL ON public.continuity_evidence_sources TO service_role;
GRANT ALL ON public.continuity_claims TO service_role;

GRANT SELECT ON public.v_continuity_claims_surface TO authenticated;
GRANT SELECT ON public.v_continuity_claims_surface TO anon;
GRANT ALL ON public.v_continuity_claims_surface TO service_role;

GRANT SELECT ON public.v_context_assets_registry TO authenticated;
GRANT SELECT ON public.v_context_assets_registry TO anon;
GRANT ALL ON public.v_context_assets_registry TO service_role;

GRANT SELECT ON public.v_continuity_dashboard_summary TO authenticated;
GRANT SELECT ON public.v_continuity_dashboard_summary TO anon;
GRANT ALL ON public.v_continuity_dashboard_summary TO service_role;
