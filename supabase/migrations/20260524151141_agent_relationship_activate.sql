update works.agents
set
  status   = 'active',
  enabled  = true,
  metadata = jsonb_build_object('llm_model', 'claude-sonnet-4-6') || coalesce(metadata, '{}'::jsonb)
where slug = 'agent_relationship';;
