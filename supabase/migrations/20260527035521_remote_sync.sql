-- Phase 2 Slice 4: graph snapshots + share grants

CREATE TABLE IF NOT EXISTS public.graph_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_root_id text NOT NULL,
  lens text NOT NULL DEFAULT 'all',
  depth integer NOT NULL DEFAULT 1 CHECK (depth >= 1 AND depth <= 3),
  captured_payload jsonb NOT NULL,
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','link','embed')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_graph_snapshots_entity_root ON public.graph_snapshots(entity_root_id);
CREATE INDEX IF NOT EXISTS idx_graph_snapshots_created_by ON public.graph_snapshots(created_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.graph_snapshots TO authenticated;
GRANT ALL ON public.graph_snapshots TO service_role;

ALTER TABLE public.graph_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators read own snapshots"
  ON public.graph_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Operators insert own snapshots"
  ON public.graph_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Operators update own snapshots"
  ON public.graph_snapshots FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Operators delete own snapshots"
  ON public.graph_snapshots FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);


CREATE TABLE IF NOT EXISTS public.entity_share_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.graph_snapshots(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  visibility text NOT NULL CHECK (visibility IN ('link','embed')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_share_grants_snapshot ON public.entity_share_grants(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_entity_share_grants_token_hash ON public.entity_share_grants(token_hash);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_share_grants TO authenticated;
GRANT ALL ON public.entity_share_grants TO service_role;

ALTER TABLE public.entity_share_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators read own grants"
  ON public.entity_share_grants FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Operators insert own grants"
  ON public.entity_share_grants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Operators update own grants"
  ON public.entity_share_grants FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Operators delete own grants"
  ON public.entity_share_grants FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);
;
