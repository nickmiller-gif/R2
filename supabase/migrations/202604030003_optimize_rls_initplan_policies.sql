-- Optimize RLS policies that use auth.role() in USING clause (per-row re-evaluation)
-- Switch to role grants on the policy itself (evaluated once at policy match time)

-- charter_governance_entities
DROP POLICY IF EXISTS governance_entity_read ON public.charter_governance_entities;
CREATE POLICY governance_entity_read ON public.charter_governance_entities
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS governance_entity_write ON public.charter_governance_entities;
CREATE POLICY governance_entity_write ON public.charter_governance_entities
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- charter_governance_transitions
DROP POLICY IF EXISTS governance_transition_read ON public.charter_governance_transitions;
CREATE POLICY governance_transition_read ON public.charter_governance_transitions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS governance_transition_write ON public.charter_governance_transitions;
CREATE POLICY governance_transition_write ON public.charter_governance_transitions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- charter_provenance_events
DROP POLICY IF EXISTS audit_log_read ON public.charter_provenance_events;
CREATE POLICY audit_log_read ON public.charter_provenance_events
  FOR SELECT TO authenticated
  USING (true);

-- tool_capabilities
DROP POLICY IF EXISTS "Authenticated users can read tool capabilities" ON public.tool_capabilities;
CREATE POLICY "Authenticated users can read tool capabilities" ON public.tool_capabilities
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage tool capabilities" ON public.tool_capabilities;
CREATE POLICY "Service role can manage tool capabilities" ON public.tool_capabilities
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- oracle_evidence_items
DROP POLICY IF EXISTS select_oracle_evidence_items ON public.oracle_evidence_items;
CREATE POLICY select_oracle_evidence_items ON public.oracle_evidence_items
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS insert_oracle_evidence_items ON public.oracle_evidence_items;
CREATE POLICY insert_oracle_evidence_items ON public.oracle_evidence_items
  FOR INSERT TO authenticated, service_role
  WITH CHECK (
    (auth.role() = 'service_role') OR (profile_id = auth.uid())
  );

DROP POLICY IF EXISTS update_oracle_evidence_items ON public.oracle_evidence_items;
CREATE POLICY update_oracle_evidence_items ON public.oracle_evidence_items
  FOR UPDATE TO authenticated, service_role
  USING (
    (auth.role() = 'service_role') OR (profile_id = auth.uid())
  )
  WITH CHECK (
    (auth.role() = 'service_role') OR (profile_id = auth.uid())
  );

DROP POLICY IF EXISTS delete_oracle_evidence_items ON public.oracle_evidence_items;
CREATE POLICY delete_oracle_evidence_items ON public.oracle_evidence_items
  FOR DELETE TO authenticated, service_role
  USING (
    (auth.role() = 'service_role') OR (profile_id = auth.uid())
  );

-- oracle_source_packs
DROP POLICY IF EXISTS select_oracle_source_packs ON public.oracle_source_packs;
CREATE POLICY select_oracle_source_packs ON public.oracle_source_packs
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS insert_oracle_source_packs ON public.oracle_source_packs;
CREATE POLICY insert_oracle_source_packs ON public.oracle_source_packs
  FOR INSERT TO authenticated, service_role
  WITH CHECK (
    (auth.role() = 'service_role') OR (profile_id = auth.uid())
  );

DROP POLICY IF EXISTS update_oracle_source_packs ON public.oracle_source_packs;
CREATE POLICY update_oracle_source_packs ON public.oracle_source_packs
  FOR UPDATE TO authenticated, service_role
  USING (
    (auth.role() = 'service_role') OR (profile_id = auth.uid())
  )
  WITH CHECK (
    (auth.role() = 'service_role') OR (profile_id = auth.uid())
  );

DROP POLICY IF EXISTS delete_oracle_source_packs ON public.oracle_source_packs;
CREATE POLICY delete_oracle_source_packs ON public.oracle_source_packs
  FOR DELETE TO authenticated, service_role
  USING (
    (auth.role() = 'service_role') OR (profile_id = auth.uid())
  );

-- oracle_theses
DROP POLICY IF EXISTS select_oracle_theses ON public.oracle_theses;
CREATE POLICY select_oracle_theses ON public.oracle_theses
  FOR SELECT TO authenticated
  USING (
    (profile_id = auth.uid()) OR (publication_state = 'published'::oracle_publication_state)
  );

DROP POLICY IF EXISTS insert_oracle_theses ON public.oracle_theses;
CREATE POLICY insert_oracle_theses ON public.oracle_theses
  FOR INSERT TO authenticated, service_role
  WITH CHECK (
    (auth.role() = 'service_role') OR (profile_id = auth.uid())
  );

DROP POLICY IF EXISTS update_oracle_theses ON public.oracle_theses;
CREATE POLICY update_oracle_theses ON public.oracle_theses
  FOR UPDATE TO authenticated, service_role
  USING (
    (auth.role() = 'service_role') OR (profile_id = auth.uid())
  )
  WITH CHECK (
    (auth.role() = 'service_role') OR (profile_id = auth.uid())
  );

DROP POLICY IF EXISTS delete_oracle_theses ON public.oracle_theses;
CREATE POLICY delete_oracle_theses ON public.oracle_theses
  FOR DELETE TO authenticated, service_role
  USING (
    (auth.role() = 'service_role') OR (profile_id = auth.uid())
  );

-- oracle_thesis_evidence_links
DROP POLICY IF EXISTS select_oracle_thesis_evidence_links ON public.oracle_thesis_evidence_links;
CREATE POLICY select_oracle_thesis_evidence_links ON public.oracle_thesis_evidence_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM oracle_theses ot
      WHERE ot.id = oracle_thesis_evidence_links.thesis_id
        AND (ot.profile_id = auth.uid() OR ot.publication_state = 'published'::oracle_publication_state)
    )
  );

DROP POLICY IF EXISTS insert_oracle_thesis_evidence_links ON public.oracle_thesis_evidence_links;
CREATE POLICY insert_oracle_thesis_evidence_links ON public.oracle_thesis_evidence_links
  FOR INSERT TO authenticated, service_role
  WITH CHECK (
    (auth.role() = 'service_role') OR
    EXISTS (
      SELECT 1 FROM oracle_theses ot
      WHERE ot.id = oracle_thesis_evidence_links.thesis_id
        AND ot.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS delete_oracle_thesis_evidence_links ON public.oracle_thesis_evidence_links;
CREATE POLICY delete_oracle_thesis_evidence_links ON public.oracle_thesis_evidence_links
  FOR DELETE TO authenticated, service_role
  USING (
    (auth.role() = 'service_role') OR
    EXISTS (
      SELECT 1 FROM oracle_theses ot
      WHERE ot.id = oracle_thesis_evidence_links.thesis_id
        AND ot.profile_id = auth.uid()
    )
  );

-- knowledge_chunks
DROP POLICY IF EXISTS "Users can read knowledge chunks for their documents" ON public.knowledge_chunks;
CREATE POLICY "Users can read knowledge chunks for their documents" ON public.knowledge_chunks
  FOR SELECT TO authenticated
  USING (
    document_id IN (SELECT id FROM documents WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert knowledge chunks for their documents" ON public.knowledge_chunks;
CREATE POLICY "Users can insert knowledge chunks for their documents" ON public.knowledge_chunks
  FOR INSERT TO authenticated
  WITH CHECK (
    document_id IN (SELECT id FROM documents WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update knowledge chunks for their documents" ON public.knowledge_chunks;
CREATE POLICY "Users can update knowledge chunks for their documents" ON public.knowledge_chunks
  FOR UPDATE TO authenticated
  USING (
    document_id IN (SELECT id FROM documents WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete knowledge chunks for their documents" ON public.knowledge_chunks;
CREATE POLICY "Users can delete knowledge chunks for their documents" ON public.knowledge_chunks
  FOR DELETE TO authenticated
  USING (
    document_id IN (SELECT id FROM documents WHERE owner_id = auth.uid())
  );

-- memory_entries
DROP POLICY IF EXISTS "Users can read their own memory entries" ON public.memory_entries;
CREATE POLICY "Users can read their own memory entries" ON public.memory_entries
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert memory entries" ON public.memory_entries;
CREATE POLICY "Users can insert memory entries" ON public.memory_entries
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own memory entries" ON public.memory_entries;
CREATE POLICY "Users can update their own memory entries" ON public.memory_entries
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own memory entries" ON public.memory_entries;
CREATE POLICY "Users can delete their own memory entries" ON public.memory_entries
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());
