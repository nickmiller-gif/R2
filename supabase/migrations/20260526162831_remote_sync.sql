DROP POLICY IF EXISTS "anon read agent messages" ON public.agent_messages;
CREATE POLICY "reviewers read agent messages" ON public.agent_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'reviewer'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS runtime_state_member_read ON public.autonomous_runtime_state;
CREATE POLICY runtime_state_operator_read ON public.autonomous_runtime_state FOR SELECT TO authenticated USING (public.is_active_operator(auth.uid()));

DROP POLICY IF EXISTS strategy_weights_member_read ON public.autonomous_strategy_weights;
CREATE POLICY strategy_weights_operator_read ON public.autonomous_strategy_weights FOR SELECT TO authenticated USING (public.is_active_operator(auth.uid()));

DROP POLICY IF EXISTS learning_outcomes_member_read ON public.autonomous_learning_outcomes;
CREATE POLICY learning_outcomes_operator_read ON public.autonomous_learning_outcomes FOR SELECT TO authenticated USING (public.is_active_operator(auth.uid()));

DROP POLICY IF EXISTS "Auth users read opportunities" ON public.investment_opportunities;
CREATE POLICY "Auth users read opportunities" ON public.investment_opportunities FOR SELECT TO authenticated USING (visibility = 'public'::visibility_level OR user_id = auth.uid() OR public.is_active_operator(auth.uid()));

DROP POLICY IF EXISTS "Auth users read all news" ON public.news_items;
CREATE POLICY "Auth users read news" ON public.news_items FOR SELECT TO authenticated USING (visibility = 'public'::visibility_level OR user_id = auth.uid() OR public.is_active_operator(auth.uid()));

DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Profiles viewable by owner or operator" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_active_operator(auth.uid()));

DROP POLICY IF EXISTS select_meg_entities ON public.meg_entities;
CREATE POLICY select_meg_entities ON public.meg_entities FOR SELECT TO authenticated USING (public.is_active_operator(auth.uid()) OR profile_id = auth.uid());

DROP POLICY IF EXISTS select_meg_entity_aliases ON public.meg_entity_aliases;
CREATE POLICY select_meg_entity_aliases ON public.meg_entity_aliases FOR SELECT TO authenticated USING (public.is_active_operator(auth.uid()) OR meg_entity_id IN (SELECT id FROM public.meg_entities WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS select_meg_entity_edges ON public.meg_entity_edges;
CREATE POLICY select_meg_entity_edges ON public.meg_entity_edges FOR SELECT TO authenticated USING (public.is_active_operator(auth.uid()) OR source_entity_id IN (SELECT id FROM public.meg_entities WHERE profile_id = auth.uid()) OR target_entity_id IN (SELECT id FROM public.meg_entities WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS continuity_agent_access_scopes_select_anon_demo ON public.continuity_agent_access_scopes;
DROP POLICY IF EXISTS continuity_agent_actions_select_anon_demo ON public.continuity_agent_actions;
DROP POLICY IF EXISTS continuity_agent_charters_select_anon_demo ON public.continuity_agent_charters;
DROP POLICY IF EXISTS continuity_claims_select_anon_demo ON public.continuity_claims;
DROP POLICY IF EXISTS continuity_context_asset_entities_select_anon_demo ON public.continuity_context_asset_entities;
DROP POLICY IF EXISTS continuity_context_assets_select_anon_demo ON public.continuity_context_assets;
DROP POLICY IF EXISTS continuity_evidence_links_select_anon_demo ON public.continuity_evidence_links;
DROP POLICY IF EXISTS continuity_evidence_sources_select_anon_demo ON public.continuity_evidence_sources;
DROP POLICY IF EXISTS continuity_friction_select_anon_demo ON public.continuity_friction_surfaces;
DROP POLICY IF EXISTS continuity_governance_events_select_anon_demo ON public.continuity_governance_events;
DROP POLICY IF EXISTS continuity_ingest_runs_select_anon_demo ON public.continuity_ingest_runs;
DROP POLICY IF EXISTS continuity_signal_channels_select_anon_demo ON public.continuity_signal_channels;
DROP POLICY IF EXISTS continuity_signal_items_select_anon_demo ON public.continuity_signal_items;
DROP POLICY IF EXISTS continuity_underwriting_select_anon_demo ON public.continuity_underwriting_runs;
DROP POLICY IF EXISTS continuity_workspaces_select_anon_demo ON public.continuity_workspaces;;
