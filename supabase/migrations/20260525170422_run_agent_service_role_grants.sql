-- R2 Works · run-agent service_role table grants (hardening follow-up)
grant select on works.agents to service_role;
grant select, insert, update on works.agent_runs to service_role;
grant select on works.calendar_events to service_role;
grant select on works.email_messages to service_role;
grant select on works.legislation_concepts to service_role;
grant select on works.legislation_concept_aliases to service_role;
grant select on works.legislation_provisions to service_role;
grant select on works.legislation_obligation_atoms to service_role;
grant select on works.legislation_atom_concepts to service_role;
grant select on works.legislation_documents to service_role;
grant select on works.legislation_jurisdiction_aliases to service_role;
grant select on public.clients to service_role;
grant select on public.meg_entities to service_role;
grant select on public.meg_entity_source_refs to service_role;
grant select on public.platform_feed_items to service_role;;
