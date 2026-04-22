-- Public corpus KOS rules: eigen_public read paths mirror eigenx member gates;
-- ingest/write paths still require operator (fetch-ingest uses public-only tags).

INSERT INTO public.eigen_policy_rules (
  policy_tag,
  capability_tag_pattern,
  effect,
  required_role,
  rationale,
  metadata
)
SELECT
  v.policy_tag,
  v.capability_tag_pattern,
  'allow',
  v.required_role::charter_role,
  v.rationale,
  '{"seed":"eigen-public-kos-20260424"}'::jsonb
FROM (
  VALUES
    ('eigen_public', 'read:*', 'member', 'Public corpus read capabilities require member role or higher.'),
    ('eigen_public', 'search', 'member', 'Public corpus retrieval search capability requires member role or higher.'),
    ('eigen_public', 'ai:*', 'member', 'Public corpus synthesis capabilities require member role or higher.'),
    ('eigen_public', 'write:*', 'operator', 'Public corpus write capabilities require operator role or higher.')
) AS v(policy_tag, capability_tag_pattern, required_role, rationale)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.eigen_policy_rules r
  WHERE r.policy_tag = v.policy_tag
    AND r.capability_tag_pattern = v.capability_tag_pattern
    AND r.effect = 'allow'
    AND r.required_role = v.required_role::charter_role
);
