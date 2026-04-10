-- Eigen policy engine rule registry.
-- Capability-tag patterns are evaluated against effective policy scope at runtime.

CREATE TABLE public.eigen_policy_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_tag text NOT NULL,
  capability_tag_pattern text NOT NULL,
  effect text NOT NULL CHECK (effect IN ('allow', 'deny')),
  required_role charter_role,
  rationale text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_eigen_policy_rules_policy_tag
  ON public.eigen_policy_rules (policy_tag);

CREATE INDEX idx_eigen_policy_rules_effect
  ON public.eigen_policy_rules (effect);

ALTER TABLE public.eigen_policy_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read eigen policy rules" ON public.eigen_policy_rules
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role can manage eigen policy rules" ON public.eigen_policy_rules
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

