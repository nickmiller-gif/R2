-- RLS initplan batch 2: wrap auth.role() / auth.uid() in scalar subqueries (Supabase advisor lint 0003).
-- Scope: MEG write policies, oracle_outcomes / oracle_thesis_knowledge_links writes (from 202604150001),
-- and idempotent recreate of Charter Slice 01 authenticated read policies (USING true).

-- ── meg_entities ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS insert_meg_entities ON public.meg_entities;
CREATE POLICY insert_meg_entities ON public.meg_entities
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
    OR profile_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS update_meg_entities ON public.meg_entities;
CREATE POLICY update_meg_entities ON public.meg_entities
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.role()) = 'service_role'
    OR profile_id = (SELECT auth.uid())
  )
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
    OR profile_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS delete_meg_entities ON public.meg_entities;
CREATE POLICY delete_meg_entities ON public.meg_entities
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.role()) = 'service_role'
    OR profile_id = (SELECT auth.uid())
  );

-- ── meg_entity_aliases ────────────────────────────────────────────────────

DROP POLICY IF EXISTS insert_meg_entity_aliases ON public.meg_entity_aliases;
CREATE POLICY insert_meg_entity_aliases ON public.meg_entity_aliases
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
    OR meg_entity_id IN (
      SELECT id FROM public.meg_entities WHERE profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS update_meg_entity_aliases ON public.meg_entity_aliases;
CREATE POLICY update_meg_entity_aliases ON public.meg_entity_aliases
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.role()) = 'service_role'
    OR meg_entity_id IN (
      SELECT id FROM public.meg_entities WHERE profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS delete_meg_entity_aliases ON public.meg_entity_aliases;
CREATE POLICY delete_meg_entity_aliases ON public.meg_entity_aliases
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.role()) = 'service_role'
    OR meg_entity_id IN (
      SELECT id FROM public.meg_entities WHERE profile_id = (SELECT auth.uid())
    )
  );

-- ── meg_entity_edges ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS insert_meg_entity_edges ON public.meg_entity_edges;
CREATE POLICY insert_meg_entity_edges ON public.meg_entity_edges
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
    OR source_entity_id IN (
      SELECT id FROM public.meg_entities WHERE profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS update_meg_entity_edges ON public.meg_entity_edges;
CREATE POLICY update_meg_entity_edges ON public.meg_entity_edges
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.role()) = 'service_role'
    OR source_entity_id IN (
      SELECT id FROM public.meg_entities WHERE profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS delete_meg_entity_edges ON public.meg_entity_edges;
CREATE POLICY delete_meg_entity_edges ON public.meg_entity_edges
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.role()) = 'service_role'
    OR source_entity_id IN (
      SELECT id FROM public.meg_entities WHERE profile_id = (SELECT auth.uid())
    )
  );

-- ── oracle_outcomes ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS insert_oracle_outcomes ON public.oracle_outcomes;
CREATE POLICY insert_oracle_outcomes ON public.oracle_outcomes
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
    OR profile_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS update_oracle_outcomes ON public.oracle_outcomes;
CREATE POLICY update_oracle_outcomes ON public.oracle_outcomes
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.role()) = 'service_role'
    OR profile_id = (SELECT auth.uid())
  )
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
    OR profile_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS delete_oracle_outcomes ON public.oracle_outcomes;
CREATE POLICY delete_oracle_outcomes ON public.oracle_outcomes
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.role()) = 'service_role'
    OR profile_id = (SELECT auth.uid())
  );

-- ── oracle_thesis_knowledge_links ─────────────────────────────────────────

DROP POLICY IF EXISTS insert_oracle_thesis_knowledge_links ON public.oracle_thesis_knowledge_links;
CREATE POLICY insert_oracle_thesis_knowledge_links ON public.oracle_thesis_knowledge_links
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
    OR thesis_id IN (
      SELECT id FROM public.oracle_theses WHERE profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS update_oracle_thesis_knowledge_links ON public.oracle_thesis_knowledge_links;
CREATE POLICY update_oracle_thesis_knowledge_links ON public.oracle_thesis_knowledge_links
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.role()) = 'service_role'
    OR thesis_id IN (
      SELECT id FROM public.oracle_theses WHERE profile_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
    OR thesis_id IN (
      SELECT id FROM public.oracle_theses WHERE profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS delete_oracle_thesis_knowledge_links ON public.oracle_thesis_knowledge_links;
CREATE POLICY delete_oracle_thesis_knowledge_links ON public.oracle_thesis_knowledge_links
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.role()) = 'service_role'
    OR thesis_id IN (
      SELECT id FROM public.oracle_theses WHERE profile_id = (SELECT auth.uid())
    )
  );

-- ── Charter Slice 01 read policies (unchanged semantics) ───────────────────

DROP POLICY IF EXISTS charter_user_roles_read ON public.charter_user_roles;
CREATE POLICY charter_user_roles_read ON public.charter_user_roles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS charter_payouts_read ON public.charter_payouts;
CREATE POLICY charter_payouts_read ON public.charter_payouts
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS charter_obligations_read ON public.charter_obligations;
CREATE POLICY charter_obligations_read ON public.charter_obligations
  FOR SELECT TO authenticated
  USING (true);
