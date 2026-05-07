-- R2Chart Continuity — Phase B.3: agent action ledger + optional access scopes
-- See continuity-nexus/docs/CONTINUITY-BACKEND-PLAN.md § Phase B.

CREATE TABLE IF NOT EXISTS public.continuity_agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.continuity_workspaces (id) ON DELETE CASCADE,
  charter_id uuid NOT NULL REFERENCES public.continuity_agent_charters (id) ON DELETE CASCADE,
  action_type text NOT NULL,
  target_kind text,
  target_id uuid,
  requested_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  decision text NOT NULL
    CHECK (decision IN ('authorized', 'denied', 'human_gated')),
  decision_reason text NOT NULL DEFAULT '',
  evidence_link_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_continuity_agent_actions_workspace_created
  ON public.continuity_agent_actions (workspace_id, created_at DESC);

CREATE INDEX idx_continuity_agent_actions_charter_created
  ON public.continuity_agent_actions (charter_id, created_at DESC);

CREATE TRIGGER continuity_agent_actions_updated_at
  BEFORE UPDATE ON public.continuity_agent_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.continuity_agent_access_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charter_id uuid NOT NULL REFERENCES public.continuity_agent_charters (id) ON DELETE CASCADE,
  scope_key text NOT NULL,
  grants jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (charter_id, scope_key)
);

CREATE INDEX idx_continuity_agent_access_scopes_charter
  ON public.continuity_agent_access_scopes (charter_id);

CREATE TRIGGER continuity_agent_access_scopes_updated_at
  BEFORE UPDATE ON public.continuity_agent_access_scopes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.continuity_agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continuity_agent_access_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY continuity_agent_actions_select_anon_demo
  ON public.continuity_agent_actions FOR SELECT TO anon
  USING (workspace_id = '11111111-1111-4111-8111-111111111111');

CREATE POLICY continuity_agent_actions_select_authenticated
  ON public.continuity_agent_actions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY continuity_agent_actions_insert_own
  ON public.continuity_agent_actions FOR INSERT TO authenticated
  WITH CHECK (
    requested_by IS NOT NULL
    AND requested_by = auth.uid()
  );

CREATE POLICY continuity_agent_actions_update_own_or_admin
  ON public.continuity_agent_actions FOR UPDATE TO authenticated
  USING (requested_by = auth.uid() OR public.continuity_is_admin())
  WITH CHECK (requested_by = auth.uid() OR public.continuity_is_admin());

CREATE POLICY continuity_agent_actions_delete_admin
  ON public.continuity_agent_actions FOR DELETE TO authenticated
  USING (public.continuity_is_admin());

CREATE POLICY continuity_agent_access_scopes_select_anon_demo
  ON public.continuity_agent_access_scopes FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.continuity_agent_charters ch
      WHERE ch.id = continuity_agent_access_scopes.charter_id
        AND ch.workspace_id = '11111111-1111-4111-8111-111111111111'
    )
  );

CREATE POLICY continuity_agent_access_scopes_select_authenticated
  ON public.continuity_agent_access_scopes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY continuity_agent_access_scopes_insert_admin
  ON public.continuity_agent_access_scopes FOR INSERT TO authenticated
  WITH CHECK (public.continuity_is_admin());

CREATE POLICY continuity_agent_access_scopes_update_admin
  ON public.continuity_agent_access_scopes FOR UPDATE TO authenticated
  USING (public.continuity_is_admin())
  WITH CHECK (public.continuity_is_admin());

CREATE POLICY continuity_agent_access_scopes_delete_admin
  ON public.continuity_agent_access_scopes FOR DELETE TO authenticated
  USING (public.continuity_is_admin());

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
  (SELECT count(*) FROM public.continuity_evidence_sources s WHERE s.workspace_id = w.id) AS evidence_source_count,
  (SELECT count(*) FROM public.continuity_agent_actions aa WHERE aa.workspace_id = w.id) AS agent_action_count
FROM public.continuity_workspaces w;

GRANT SELECT ON public.continuity_agent_actions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.continuity_agent_actions TO authenticated;
GRANT ALL ON public.continuity_agent_actions TO service_role;

GRANT SELECT ON public.continuity_agent_access_scopes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.continuity_agent_access_scopes TO authenticated;
GRANT ALL ON public.continuity_agent_access_scopes TO service_role;

GRANT SELECT ON public.v_continuity_dashboard_summary TO authenticated;
GRANT SELECT ON public.v_continuity_dashboard_summary TO anon;
GRANT ALL ON public.v_continuity_dashboard_summary TO service_role;
