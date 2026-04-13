-- Baseline non-breaking Eigen policy rules.
-- These preserve current internal capability behavior while enabling runtime rule evaluation.

INSERT INTO public.eigen_policy_rules (
  policy_tag,
  capability_tag_pattern,
  effect,
  required_role,
  rationale,
  metadata
)
SELECT
  'eigenx',
  '*',
  'allow',
  NULL,
  'Baseline internal access for eigenx scope.',
  '{"seed":"baseline-20260413"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.eigen_policy_rules
  WHERE policy_tag = 'eigenx'
    AND capability_tag_pattern = '*'
    AND effect = 'allow'
    AND required_role IS NULL
);

INSERT INTO public.eigen_policy_rules (
  policy_tag,
  capability_tag_pattern,
  effect,
  required_role,
  rationale,
  metadata
)
SELECT
  'eigenx:*',
  '*',
  'allow',
  NULL,
  'Baseline internal access for user-scoped eigenx tags.',
  '{"seed":"baseline-20260413"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.eigen_policy_rules
  WHERE policy_tag = 'eigenx:*'
    AND capability_tag_pattern = '*'
    AND effect = 'allow'
    AND required_role IS NULL
);

INSERT INTO public.eigen_policy_rules (
  policy_tag,
  capability_tag_pattern,
  effect,
  required_role,
  rationale,
  metadata
)
SELECT
  'eigenx',
  'write:*',
  'allow',
  'operator'::charter_role,
  'Write-class capabilities require operator role in baseline policy.',
  '{"seed":"baseline-20260413"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.eigen_policy_rules
  WHERE policy_tag = 'eigenx'
    AND capability_tag_pattern = 'write:*'
    AND effect = 'allow'
    AND required_role = 'operator'::charter_role
);
