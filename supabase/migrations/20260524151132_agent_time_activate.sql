update works.agents
set
  status   = 'active',
  enabled  = true,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('llm_model', 'claude-sonnet-4-6')
where slug = 'agent_time';;
