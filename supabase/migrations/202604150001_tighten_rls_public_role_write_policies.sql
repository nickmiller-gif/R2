-- Tighten RLS write policies on 5 MEG/Oracle tables from implicit {public} to {authenticated}.
--
-- Finding 1 from RLS-AUDIT-PHASE-B.md: INSERT/UPDATE/DELETE policies on
-- meg_entities, meg_entity_aliases, meg_entity_edges, oracle_outcomes, and
-- oracle_thesis_knowledge_links were created without an explicit TO clause,
-- defaulting to {public} (anon role). While the ownership checks prevent
-- actual exploitation, this is a hygiene/defense-in-depth issue.
--
-- Fix: Drop and recreate each write policy with TO authenticated so the
-- anon role is explicitly excluded. The service_role Postgres role bypasses
-- RLS by design and is unaffected.

-- ── meg_entities ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS insert_meg_entities ON public.meg_entities;
CREATE POLICY insert_meg_entities ON public.meg_entities
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'service_role' OR profile_id = auth.uid());

DROP POLICY IF EXISTS update_meg_entities ON public.meg_entities;
CREATE POLICY update_meg_entities ON public.meg_entities
  FOR UPDATE TO authenticated
  USING (auth.role() = 'service_role' OR profile_id = auth.uid())
  WITH CHECK (auth.role() = 'service_role' OR profile_id = auth.uid());

DROP POLICY IF EXISTS delete_meg_entities ON public.meg_entities;
CREATE POLICY delete_meg_entities ON public.meg_entities
  FOR DELETE TO authenticated
  USING (auth.role() = 'service_role' OR profile_id = auth.uid());

-- ── meg_entity_aliases ────────────────────────────────────────────────────

DROP POLICY IF EXISTS insert_meg_entity_aliases ON public.meg_entity_aliases;
CREATE POLICY insert_meg_entity_aliases ON public.meg_entity_aliases
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.role() = 'service_role'
    OR meg_entity_id IN (SELECT id FROM public.meg_entities WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS update_meg_entity_aliases ON public.meg_entity_aliases;
CREATE POLICY update_meg_entity_aliases ON public.meg_entity_aliases
  FOR UPDATE TO authenticated
  USING (
    auth.role() = 'service_role'
    OR meg_entity_id IN (SELECT id FROM public.meg_entities WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS delete_meg_entity_aliases ON public.meg_entity_aliases;
CREATE POLICY delete_meg_entity_aliases ON public.meg_entity_aliases
  FOR DELETE TO authenticated
  USING (
    auth.role() = 'service_role'
    OR meg_entity_id IN (SELECT id FROM public.meg_entities WHERE profile_id = auth.uid())
  );

-- ── meg_entity_edges ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS insert_meg_entity_edges ON public.meg_entity_edges;
CREATE POLICY insert_meg_entity_edges ON public.meg_entity_edges
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.role() = 'service_role'
    OR source_entity_id IN (SELECT id FROM public.meg_entities WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS update_meg_entity_edges ON public.meg_entity_edges;
CREATE POLICY update_meg_entity_edges ON public.meg_entity_edges
  FOR UPDATE TO authenticated
  USING (
    auth.role() = 'service_role'
    OR source_entity_id IN (SELECT id FROM public.meg_entities WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS delete_meg_entity_edges ON public.meg_entity_edges;
CREATE POLICY delete_meg_entity_edges ON public.meg_entity_edges
  FOR DELETE TO authenticated
  USING (
    auth.role() = 'service_role'
    OR source_entity_id IN (SELECT id FROM public.meg_entities WHERE profile_id = auth.uid())
  );

-- ── oracle_outcomes ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS insert_oracle_outcomes ON public.oracle_outcomes;
CREATE POLICY insert_oracle_outcomes ON public.oracle_outcomes
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'service_role' OR profile_id = auth.uid());

DROP POLICY IF EXISTS update_oracle_outcomes ON public.oracle_outcomes;
CREATE POLICY update_oracle_outcomes ON public.oracle_outcomes
  FOR UPDATE TO authenticated
  USING (auth.role() = 'service_role' OR profile_id = auth.uid())
  WITH CHECK (auth.role() = 'service_role' OR profile_id = auth.uid());

DROP POLICY IF EXISTS delete_oracle_outcomes ON public.oracle_outcomes;
CREATE POLICY delete_oracle_outcomes ON public.oracle_outcomes
  FOR DELETE TO authenticated
  USING (auth.role() = 'service_role' OR profile_id = auth.uid());

-- ── oracle_thesis_knowledge_links ─────────────────────────────────────────

DROP POLICY IF EXISTS insert_oracle_thesis_knowledge_links ON public.oracle_thesis_knowledge_links;
CREATE POLICY insert_oracle_thesis_knowledge_links ON public.oracle_thesis_knowledge_links
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.role() = 'service_role'
    OR thesis_id IN (SELECT id FROM public.oracle_theses WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS update_oracle_thesis_knowledge_links ON public.oracle_thesis_knowledge_links;
CREATE POLICY update_oracle_thesis_knowledge_links ON public.oracle_thesis_knowledge_links
  FOR UPDATE TO authenticated
  USING (
    auth.role() = 'service_role'
    OR thesis_id IN (SELECT id FROM public.oracle_theses WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR thesis_id IN (SELECT id FROM public.oracle_theses WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS delete_oracle_thesis_knowledge_links ON public.oracle_thesis_knowledge_links;
CREATE POLICY delete_oracle_thesis_knowledge_links ON public.oracle_thesis_knowledge_links
  FOR DELETE TO authenticated
  USING (
    auth.role() = 'service_role'
    OR thesis_id IN (SELECT id FROM public.oracle_theses WHERE profile_id = auth.uid())
  );
