update works.agents
set
  status   = 'active',
  enabled  = true,
  metadata = jsonb_build_object('llm_model', 'claude-opus-4-7') || coalesce(metadata, '{}'::jsonb)
where slug = 'agent_finance';;
