alter table works.agents
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column works.agents.metadata is
  'Per-agent config bag — currently stores llm_model. Read by run-agent edge function during dispatch.';;
