
-- ====== botos_* tables: operators-only read ======
drop policy if exists "botos_chatbot_turns_select_anon" on public.botos_chatbot_turns;
drop policy if exists "botos_chatbot_turns_select_authenticated" on public.botos_chatbot_turns;
create policy "botos_chatbot_turns_select_operator"
  on public.botos_chatbot_turns for select to authenticated
  using (public.is_active_operator((select auth.uid())));

drop policy if exists "botos_chatbot_facts_select_anon" on public.botos_chatbot_facts;
drop policy if exists "botos_chatbot_facts_select_authenticated" on public.botos_chatbot_facts;
create policy "botos_chatbot_facts_select_operator"
  on public.botos_chatbot_facts for select to authenticated
  using (public.is_active_operator((select auth.uid())));

drop policy if exists "botos_page_captures_select_anon" on public.botos_page_captures;
drop policy if exists "botos_page_captures_select_auth" on public.botos_page_captures;
create policy "botos_page_captures_select_operator"
  on public.botos_page_captures for select to authenticated
  using (public.is_active_operator((select auth.uid())));

drop policy if exists "botos_page_facts_select_anon" on public.botos_page_facts;
drop policy if exists "botos_page_facts_select_auth" on public.botos_page_facts;
create policy "botos_page_facts_select_operator"
  on public.botos_page_facts for select to authenticated
  using (public.is_active_operator((select auth.uid())));

-- ====== profiles: drop anon read ======
drop policy if exists "profiles_public_read" on public.profiles;

-- ====== oracle_outcomes: own row or operator ======
drop policy if exists "select_oracle_outcomes" on public.oracle_outcomes;
create policy "select_oracle_outcomes"
  on public.oracle_outcomes for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_active_operator((select auth.uid()))
  );

-- ====== oracle_thesis_knowledge_links: scope through parent thesis ownership or operator ======
drop policy if exists "select_oracle_thesis_knowledge_links" on public.oracle_thesis_knowledge_links;
create policy "select_oracle_thesis_knowledge_links"
  on public.oracle_thesis_knowledge_links for select to authenticated
  using (
    public.is_active_operator((select auth.uid()))
    or thesis_id in (
      select id from public.oracle_theses where profile_id = (select auth.uid())
    )
  );

-- ====== oracle_run_scorecards: operators-only ======
drop policy if exists "select_oracle_run_scorecards" on public.oracle_run_scorecards;
create policy "select_oracle_run_scorecards"
  on public.oracle_run_scorecards for select to authenticated
  using (public.is_active_operator((select auth.uid())));

-- ====== oracle_profile_runs: operators-only ======
drop policy if exists "select_oracle_profile_runs" on public.oracle_profile_runs;
create policy "select_oracle_profile_runs"
  on public.oracle_profile_runs for select to authenticated
  using (public.is_active_operator((select auth.uid())));

-- ====== oracle_whitespace_core_runs: operators-only ======
drop policy if exists "select_oracle_whitespace_core_runs" on public.oracle_whitespace_core_runs;
create policy "select_oracle_whitespace_core_runs"
  on public.oracle_whitespace_core_runs for select to authenticated
  using (public.is_active_operator((select auth.uid())));

-- ====== oracle_service_layer_runs: operators-only ======
drop policy if exists "select_oracle_service_layer_runs" on public.oracle_service_layer_runs;
create policy "select_oracle_service_layer_runs"
  on public.oracle_service_layer_runs for select to authenticated
  using (public.is_active_operator((select auth.uid())));

-- ====== oracle_service_layer_run_decisions: operators-only ======
drop policy if exists "select_oracle_service_layer_run_decisions" on public.oracle_service_layer_run_decisions;
create policy "select_oracle_service_layer_run_decisions"
  on public.oracle_service_layer_run_decisions for select to authenticated
  using (public.is_active_operator((select auth.uid())));

-- ====== oracle_service_layer_run_outcomes: operators-only ======
drop policy if exists "select_oracle_service_layer_run_outcomes" on public.oracle_service_layer_run_outcomes;
create policy "select_oracle_service_layer_run_outcomes"
  on public.oracle_service_layer_run_outcomes for select to authenticated
  using (public.is_active_operator((select auth.uid())));

-- ====== oracle_graph_extraction_jobs: operators-only ======
drop policy if exists "select_oracle_graph_extraction_jobs" on public.oracle_graph_extraction_jobs;
create policy "select_oracle_graph_extraction_jobs"
  on public.oracle_graph_extraction_jobs for select to authenticated
  using (public.is_active_operator((select auth.uid())));
;
