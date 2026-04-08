-- Per-user/per-role access grants for Eigen private policy subsets.

CREATE TYPE eigen_policy_principal_type AS ENUM ('user', 'role');
CREATE TYPE eigen_policy_grant_status AS ENUM ('active', 'paused', 'revoked');

CREATE TABLE IF NOT EXISTS public.eigen_policy_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_type eigen_policy_principal_type NOT NULL,
  principal_id text NOT NULL,
  policy_tag text NOT NULL,
  status eigen_policy_grant_status NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (principal_type, principal_id, policy_tag)
);

CREATE INDEX IF NOT EXISTS idx_eigen_policy_access_grants_principal
  ON public.eigen_policy_access_grants(principal_type, principal_id);

CREATE INDEX IF NOT EXISTS idx_eigen_policy_access_grants_status
  ON public.eigen_policy_access_grants(status);

ALTER TABLE public.eigen_policy_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages eigen policy access grants"
  ON public.eigen_policy_access_grants
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
