-- Eigen site registry: optional policy/capability metadata for KOS-aligned routing.
-- Service-layer writes only (RLS unchanged on eigen_site_registry).

ALTER TABLE public.eigen_site_registry
  ADD COLUMN IF NOT EXISTS policy_notes text,
  ADD COLUMN IF NOT EXISTS capability_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.eigen_site_registry.policy_notes IS
  'Operator-facing notes on default policy scope and site posture.';
COMMENT ON COLUMN public.eigen_site_registry.capability_profile IS
  'JSON bag for capability registry hints (allowed surfaces, default tags, etc.).';
