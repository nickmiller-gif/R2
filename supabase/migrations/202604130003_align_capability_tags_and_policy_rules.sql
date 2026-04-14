-- Align capability tags with policy evaluation semantics.
-- 1) Add mode-sensitive tags so policy rules can distinguish read vs write.
-- 2) Replace broad wildcard allow rules with explicit read/write role gates.

UPDATE public.tool_capabilities
SET capability_tags = (
  SELECT to_jsonb(array_agg(tag ORDER BY tag))
  FROM (
    SELECT DISTINCT tag
    FROM (
      SELECT jsonb_array_elements_text(public.tool_capabilities.capability_tags) AS tag
      UNION ALL
      SELECT CASE
        WHEN public.tool_capabilities.mode = 'read'::tool_mode THEN 'read:*'
        ELSE 'write:*'
      END
    ) AS merged
  ) AS deduped
)
WHERE TRUE;

-- Retire permissive baseline wildcard rules.
DELETE FROM public.eigen_policy_rules
WHERE effect = 'allow'
  AND required_role IS NULL
  AND (
    (policy_tag = 'eigenx' AND capability_tag_pattern = '*')
    OR (policy_tag = 'eigenx:*' AND capability_tag_pattern = '*')
  );

-- Explicit read/write role gates for org and user-scoped policy tags.
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
  '{"seed":"capability-alignment-20260413"}'::jsonb
FROM (
  VALUES
    ('eigenx', 'read:*', 'member', 'Read capabilities require member role or higher.'),
    ('eigenx:*', 'read:*', 'member', 'User-scoped read capabilities require member role or higher.'),
    ('eigenx', 'write:*', 'operator', 'Write capabilities require operator role or higher.'),
    ('eigenx:*', 'write:*', 'operator', 'User-scoped write capabilities require operator role or higher.')
) AS v(policy_tag, capability_tag_pattern, required_role, rationale)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.eigen_policy_rules r
  WHERE r.policy_tag = v.policy_tag
    AND r.capability_tag_pattern = v.capability_tag_pattern
    AND r.effect = 'allow'
    AND r.required_role = v.required_role::charter_role
);
