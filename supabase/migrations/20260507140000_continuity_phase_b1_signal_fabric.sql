-- R2Chart Continuity — Phase B.1: signal fabric (ingest runs + normalized signal items)
-- See continuity-nexus/docs/CONTINUITY-BACKEND-PLAN.md § Phase B.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.continuity_ingest_run_status AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.continuity_signal_processing_status AS ENUM (
    'received',
    'normalized',
    'promoted',
    'rejected',
    'sealed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.continuity_ingest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.continuity_workspaces (id) ON DELETE CASCADE,
  signal_channel_id uuid REFERENCES public.continuity_signal_channels (id) ON DELETE SET NULL,
  source_system text NOT NULL,
  destination_system text NOT NULL DEFAULT 'r2chart_continuity',
  trigger_kind text NOT NULL DEFAULT 'manual',
  status public.continuity_ingest_run_status NOT NULL DEFAULT 'pending',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  rows_accepted integer NOT NULL DEFAULT 0 CHECK (rows_accepted >= 0),
  rows_rejected integer NOT NULL DEFAULT 0 CHECK (rows_rejected >= 0),
  error_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_continuity_ingest_runs_workspace_started
  ON public.continuity_ingest_runs (workspace_id, started_at DESC);

CREATE INDEX idx_continuity_ingest_runs_channel
  ON public.continuity_ingest_runs (signal_channel_id)
  WHERE signal_channel_id IS NOT NULL;

CREATE TRIGGER continuity_ingest_runs_updated_at
  BEFORE UPDATE ON public.continuity_ingest_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.continuity_signal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.continuity_workspaces (id) ON DELETE CASCADE,
  ingest_run_id uuid REFERENCES public.continuity_ingest_runs (id) ON DELETE SET NULL,
  idempotency_key text,
  source_system text NOT NULL,
  source_event_type text NOT NULL,
  source_record_id text,
  source_url text,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text NOT NULL,
  actor_external_ref text,
  subject_external_ref text,
  related_external_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  signal_type text NOT NULL DEFAULT 'domain_event',
  confidence numeric(5,2),
  sensitivity_level text NOT NULL DEFAULT 'internal',
  processing_status public.continuity_signal_processing_status NOT NULL DEFAULT 'received',
  processed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: duplicate (workspace_id, idempotency_key) rejected when key is set.
-- Multiple rows with NULL idempotency_key are allowed (PostgreSQL UNIQUE NULL semantics).
CREATE UNIQUE INDEX idx_continuity_signal_items_idempotency
  ON public.continuity_signal_items (workspace_id, idempotency_key);

CREATE INDEX idx_continuity_signal_items_workspace_created
  ON public.continuity_signal_items (workspace_id, created_at DESC);

CREATE INDEX idx_continuity_signal_items_ingest_run
  ON public.continuity_signal_items (ingest_run_id)
  WHERE ingest_run_id IS NOT NULL;

CREATE INDEX idx_continuity_signal_items_source
  ON public.continuity_signal_items (workspace_id, source_system, source_event_type);

-- Optional integrity: last_ingest_run_id on channels must point at a real run when set.
ALTER TABLE public.continuity_signal_channels
  DROP CONSTRAINT IF EXISTS continuity_signal_channels_last_ingest_run_id_fkey;

ALTER TABLE public.continuity_signal_channels
  ADD CONSTRAINT continuity_signal_channels_last_ingest_run_id_fkey
  FOREIGN KEY (last_ingest_run_id) REFERENCES public.continuity_ingest_runs (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.continuity_ingest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continuity_signal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY continuity_ingest_runs_select_anon_demo
  ON public.continuity_ingest_runs FOR SELECT TO anon
  USING (workspace_id = '11111111-1111-4111-8111-111111111111');

CREATE POLICY continuity_signal_items_select_anon_demo
  ON public.continuity_signal_items FOR SELECT TO anon
  USING (workspace_id = '11111111-1111-4111-8111-111111111111');

CREATE POLICY continuity_ingest_runs_select_authenticated
  ON public.continuity_ingest_runs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY continuity_ingest_runs_insert_own
  ON public.continuity_ingest_runs FOR INSERT TO authenticated
  WITH CHECK (
    (created_by IS NOT NULL AND created_by = auth.uid())
    OR public.continuity_is_admin()
  );

CREATE POLICY continuity_ingest_runs_update_own_or_admin
  ON public.continuity_ingest_runs FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.continuity_is_admin())
  WITH CHECK (created_by = auth.uid() OR public.continuity_is_admin());

CREATE POLICY continuity_ingest_runs_delete_admin
  ON public.continuity_ingest_runs FOR DELETE TO authenticated
  USING (public.continuity_is_admin());

CREATE POLICY continuity_signal_items_select_authenticated
  ON public.continuity_signal_items FOR SELECT TO authenticated
  USING (true);

-- Signal rows are usually written by service role / Edge; authenticated insert for operators.
CREATE POLICY continuity_signal_items_insert_authenticated
  ON public.continuity_signal_items FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY continuity_signal_items_update_admin
  ON public.continuity_signal_items FOR UPDATE TO authenticated
  USING (public.continuity_is_admin())
  WITH CHECK (public.continuity_is_admin());

CREATE POLICY continuity_signal_items_delete_admin
  ON public.continuity_signal_items FOR DELETE TO authenticated
  USING (public.continuity_is_admin());

-- ---------------------------------------------------------------------------
-- Read-model views
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_continuity_signal_feed
WITH (security_invoker = true) AS
SELECT
  si.id,
  si.workspace_id,
  si.ingest_run_id,
  si.source_system,
  si.source_event_type,
  si.source_record_id,
  si.summary,
  si.signal_type,
  si.sensitivity_level,
  si.processing_status,
  si.confidence,
  si.created_at,
  si.processed_at,
  ir.status AS ingest_run_status,
  ir.started_at AS ingest_started_at
FROM public.continuity_signal_items si
LEFT JOIN public.continuity_ingest_runs ir ON ir.id = si.ingest_run_id;

CREATE OR REPLACE VIEW public.v_signal_channel_map
WITH (security_invoker = true) AS
SELECT
  sc.id,
  sc.workspace_id,
  sc.source_system,
  sc.destination_system,
  sc.signal_type,
  sc.throughput_score,
  sc.integrity_score,
  sc.integrity_band,
  sc.state,
  sc.last_handshake_at,
  sc.last_ingest_run_id,
  sc.policy_scope,
  sc.metadata,
  sc.created_by,
  sc.created_at,
  sc.updated_at,
  coalesce(sc.metadata ->> 'channel_label', sc.signal_type) AS channel_label,
  coalesce(sc.metadata ->> 'from_custodian', sc.source_system) AS from_custodian,
  coalesce(sc.metadata ->> 'to_custodian', sc.destination_system) AS to_custodian,
  ir.completed_at AS last_ingest_completed_at,
  ir.rows_accepted AS last_ingest_rows_accepted,
  ir.rows_rejected AS last_ingest_rows_rejected,
  ir.status AS last_ingest_status
FROM public.continuity_signal_channels sc
LEFT JOIN public.continuity_ingest_runs ir ON ir.id = sc.last_ingest_run_id;

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
  (SELECT max(si.created_at) FROM public.continuity_signal_items si WHERE si.workspace_id = w.id) AS last_signal_item_at
FROM public.continuity_workspaces w;

-- ---------------------------------------------------------------------------
-- Seed (demo workspace): one ingest run + signals; wire meg channel last_ingest
-- ---------------------------------------------------------------------------

INSERT INTO public.continuity_ingest_runs (
  id,
  workspace_id,
  signal_channel_id,
  source_system,
  destination_system,
  trigger_kind,
  status,
  started_at,
  completed_at,
  rows_accepted,
  rows_rejected,
  metadata
)
VALUES (
  '22222222-2222-4222-8222-222222222221'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  (SELECT id FROM public.continuity_signal_channels
     WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
       AND source_system = 'meg'
       AND destination_system = 'r2chart_continuity'
       AND signal_type = 'identity_resolution'
     LIMIT 1),
  'meg',
  'r2chart_continuity',
  'seed',
  'completed',
  now() - interval '2 hours',
  now() - interval '119 minutes',
  3,
  0,
  '{"note":"Phase B.1 seed ingest"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.continuity_signal_channels sc
SET last_ingest_run_id = '22222222-2222-4222-8222-222222222221'::uuid,
    metadata = coalesce(sc.metadata, '{}'::jsonb) || jsonb_build_object('last_seed_ingest', true)
WHERE sc.workspace_id = '11111111-1111-4111-8111-111111111111'
  AND sc.source_system = 'meg'
  AND sc.destination_system = 'r2chart_continuity'
  AND sc.signal_type = 'identity_resolution';

INSERT INTO public.continuity_signal_items (
  workspace_id,
  ingest_run_id,
  idempotency_key,
  source_system,
  source_event_type,
  source_record_id,
  summary,
  signal_type,
  sensitivity_level,
  processing_status,
  confidence,
  source_payload
) VALUES
(
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222221',
  'seed:meg:identity_cluster_merged:v1',
  'meg',
  'identity_cluster_merged',
  'meg-cluster-88421',
  'MEG merged operator Halverson across three custodian records.',
  'identity_resolution',
  'internal',
  'normalized',
  0.91,
  '{"custodians":["r2_works","centralr2","rays_retreat"]}'::jsonb
),
(
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222221',
  'seed:meg:property_edge_linked:v1',
  'meg',
  'property_edge_linked',
  'meg-edge-22109',
  'Property Hawthorn Trust linked to LLC shell with medium confidence.',
  'identity_resolution',
  'internal',
  'received',
  0.62,
  '{"property_display":"Hawthorn Property Trust"}'::jsonb
),
(
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222221',
  'seed:meg:oracle_actor_hint:v1',
  'meg',
  'oracle_actor_hint',
  'meg-hint-0092',
  'Whitespace actor hint attached to unresolved M. Park thread.',
  'identity_resolution',
  'internal',
  'received',
  0.55,
  '{"thread":"Eigen thread 09"}'::jsonb
)
ON CONFLICT (workspace_id, idempotency_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT SELECT ON public.continuity_ingest_runs TO anon;
GRANT SELECT ON public.continuity_signal_items TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.continuity_ingest_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.continuity_signal_items TO authenticated;

GRANT SELECT ON public.v_continuity_signal_feed TO authenticated;
GRANT SELECT ON public.v_continuity_signal_feed TO anon;

GRANT ALL ON public.continuity_ingest_runs TO service_role;
GRANT ALL ON public.continuity_signal_items TO service_role;
GRANT ALL ON public.v_continuity_signal_feed TO service_role;

-- Re-grant replaced views (CREATE OR REPLACE does not reset grants on some hosts)
GRANT SELECT ON public.v_signal_channel_map TO authenticated;
GRANT SELECT ON public.v_signal_channel_map TO anon;
GRANT ALL ON public.v_signal_channel_map TO service_role;

GRANT SELECT ON public.v_continuity_dashboard_summary TO authenticated;
GRANT SELECT ON public.v_continuity_dashboard_summary TO anon;
GRANT ALL ON public.v_continuity_dashboard_summary TO service_role;
