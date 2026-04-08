-- Site registry for website widget policy and source mapping.

CREATE TYPE eigen_site_mode AS ENUM ('public', 'eigenx', 'mixed');
CREATE TYPE eigen_site_status AS ENUM ('active', 'paused', 'archived');

CREATE TABLE IF NOT EXISTS public.eigen_site_registry (
  site_id text PRIMARY KEY,
  display_name text NOT NULL,
  mode eigen_site_mode NOT NULL DEFAULT 'public',
  origins jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_systems jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_policy_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  status eigen_site_status NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eigen_site_registry_status
  ON public.eigen_site_registry(status);

ALTER TABLE public.eigen_site_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages eigen site registry"
  ON public.eigen_site_registry
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
