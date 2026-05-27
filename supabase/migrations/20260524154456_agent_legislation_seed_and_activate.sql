insert into works.agents (slug, name, tagline, description, status, trigger_kind, governance_scope, sort_order, metadata)
values (
  'agent_legislation',
  'AI Legislative Scout',
  'Maps an AI use case to the laws you should be aware of.',
  'Operator describes what they want to do, with which AI system, in which jurisdiction, and as which org type (commercial / non-profit). The agent classifies the intent into the seeded legislation_concepts taxonomy (actors / subjects / triggers / obligations) and returns a structured concept profile + targeted research questions. Phase 5a: concept-only classifier. Phase 5b adds statute citations once legislation_provisions is populated.',
  'active',
  'on_demand',
  'commercial',
  50,
  jsonb_build_object('llm_model', 'claude-sonnet-4-6')
)
on conflict (slug) do update
  set
    status   = 'active',
    enabled  = true,
    metadata = jsonb_build_object('llm_model', 'claude-sonnet-4-6') || coalesce(works.agents.metadata, '{}'::jsonb);

update works.agents
set
  enabled = true
where slug = 'agent_legislation';;
