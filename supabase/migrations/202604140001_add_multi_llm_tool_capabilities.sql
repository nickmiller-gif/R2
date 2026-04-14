-- Add explicit capabilities for multi-provider chat orchestration and confidence scoring.
-- Idempotent upserts keyed by tool_id.

INSERT INTO public.tool_capabilities (
  tool_id,
  name,
  capability_tags,
  mode,
  approval_policy,
  role_requirements,
  connector_dependencies,
  blast_radius,
  fallback_mode
)
VALUES
  ('edge.eigen-chat-router.write','Eigen chat model routing','["eigen","eigenx","chat","router","llm"]'::jsonb,'write'::tool_mode,'user_approval'::approval_policy,'["member"]'::jsonb,'["openai","anthropic","perplexity"]'::jsonb,'medium','deny'),
  ('edge.eigen-chat-confidence.read','Eigen chat confidence analytics','["eigen","eigenx","chat","confidence"]'::jsonb,'read'::tool_mode,'none_required'::approval_policy,'["member"]'::jsonb,'[]'::jsonb,'low','none'),
  ('edge.eigen-chat-provider-policy.write','Eigen chat provider policy controls','["eigen","eigenx","chat","governance","provider_policy"]'::jsonb,'write'::tool_mode,'admin_approval'::approval_policy,'["admin"]'::jsonb,'[]'::jsonb,'high','deny')
ON CONFLICT (tool_id) DO UPDATE
SET
  name = EXCLUDED.name,
  capability_tags = EXCLUDED.capability_tags,
  mode = EXCLUDED.mode,
  approval_policy = EXCLUDED.approval_policy,
  role_requirements = EXCLUDED.role_requirements,
  connector_dependencies = EXCLUDED.connector_dependencies,
  blast_radius = EXCLUDED.blast_radius,
  fallback_mode = EXCLUDED.fallback_mode,
  updated_at = now();
