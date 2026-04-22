-- RLS initplan batch 3 (Oracle publication boundary): Supabase lint 0003 (auth_rls_initplan).
-- Scope: oracle_theses, oracle_evidence_items, oracle_source_packs, oracle_thesis_evidence_links,
-- oracle_profile_runs, oracle_whitespace_core_runs, oracle_service_layer_runs.
-- Pattern: (SELECT auth.uid()) / (SELECT auth.role()) in expressions; TO service_role + true for
-- service-only tables (see 202604030003, 202604230003).

-- ── oracle_theses (select from 202604090004; writes from 202604030003) ─────

DROP POLICY IF EXISTS select_oracle_theses ON public.oracle_theses;
CREATE POLICY select_oracle_theses ON public.oracle_theses
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR publication_state = 'published'::oracle_publication_state
    OR EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS insert_oracle_theses ON public.oracle_theses;
CREATE POLICY insert_oracle_theses ON public.oracle_theses
  FOR INSERT TO authenticated, service_role
  WITH CHECK (
    ((SELECT auth.role()) = 'service_role') OR (profile_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS update_oracle_theses ON public.oracle_theses;
CREATE POLICY update_oracle_theses ON public.oracle_theses
  FOR UPDATE TO authenticated, service_role
  USING (
    ((SELECT auth.role()) = 'service_role') OR (profile_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    ((SELECT auth.role()) = 'service_role') OR (profile_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS delete_oracle_theses ON public.oracle_theses;
CREATE POLICY delete_oracle_theses ON public.oracle_theses
  FOR DELETE TO authenticated, service_role
  USING (
    ((SELECT auth.role()) = 'service_role') OR (profile_id = (SELECT auth.uid()))
  );

-- ── oracle_evidence_items (202604030003) ───────────────────────────────────

DROP POLICY IF EXISTS select_oracle_evidence_items ON public.oracle_evidence_items;
CREATE POLICY select_oracle_evidence_items ON public.oracle_evidence_items
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS insert_oracle_evidence_items ON public.oracle_evidence_items;
CREATE POLICY insert_oracle_evidence_items ON public.oracle_evidence_items
  FOR INSERT TO authenticated, service_role
  WITH CHECK (
    ((SELECT auth.role()) = 'service_role') OR (profile_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS update_oracle_evidence_items ON public.oracle_evidence_items;
CREATE POLICY update_oracle_evidence_items ON public.oracle_evidence_items
  FOR UPDATE TO authenticated, service_role
  USING (
    ((SELECT auth.role()) = 'service_role') OR (profile_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    ((SELECT auth.role()) = 'service_role') OR (profile_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS delete_oracle_evidence_items ON public.oracle_evidence_items;
CREATE POLICY delete_oracle_evidence_items ON public.oracle_evidence_items
  FOR DELETE TO authenticated, service_role
  USING (
    ((SELECT auth.role()) = 'service_role') OR (profile_id = (SELECT auth.uid()))
  );

-- ── oracle_source_packs (202604030003) ─────────────────────────────────────

DROP POLICY IF EXISTS select_oracle_source_packs ON public.oracle_source_packs;
CREATE POLICY select_oracle_source_packs ON public.oracle_source_packs
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS insert_oracle_source_packs ON public.oracle_source_packs;
CREATE POLICY insert_oracle_source_packs ON public.oracle_source_packs
  FOR INSERT TO authenticated, service_role
  WITH CHECK (
    ((SELECT auth.role()) = 'service_role') OR (profile_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS update_oracle_source_packs ON public.oracle_source_packs;
CREATE POLICY update_oracle_source_packs ON public.oracle_source_packs
  FOR UPDATE TO authenticated, service_role
  USING (
    ((SELECT auth.role()) = 'service_role') OR (profile_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    ((SELECT auth.role()) = 'service_role') OR (profile_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS delete_oracle_source_packs ON public.oracle_source_packs;
CREATE POLICY delete_oracle_source_packs ON public.oracle_source_packs
  FOR DELETE TO authenticated, service_role
  USING (
    ((SELECT auth.role()) = 'service_role') OR (profile_id = (SELECT auth.uid()))
  );

-- ── oracle_thesis_evidence_links (select 202604090004; writes 202604030003) ─

DROP POLICY IF EXISTS select_oracle_thesis_evidence_links ON public.oracle_thesis_evidence_links;
CREATE POLICY select_oracle_thesis_evidence_links ON public.oracle_thesis_evidence_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.oracle_theses ot
      WHERE ot.id = oracle_thesis_evidence_links.thesis_id
        AND (
          ot.profile_id = (SELECT auth.uid())
          OR ot.publication_state = 'published'::oracle_publication_state
          OR EXISTS (
            SELECT 1
            FROM public.charter_user_roles cur
            WHERE cur.user_id = (SELECT auth.uid())
              AND cur.role::text IN ('operator', 'counsel', 'admin')
          )
        )
    )
  );

DROP POLICY IF EXISTS insert_oracle_thesis_evidence_links ON public.oracle_thesis_evidence_links;
CREATE POLICY insert_oracle_thesis_evidence_links ON public.oracle_thesis_evidence_links
  FOR INSERT TO authenticated, service_role
  WITH CHECK (
    ((SELECT auth.role()) = 'service_role')
    OR EXISTS (
      SELECT 1 FROM public.oracle_theses ot
      WHERE ot.id = oracle_thesis_evidence_links.thesis_id
        AND ot.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS delete_oracle_thesis_evidence_links ON public.oracle_thesis_evidence_links;
CREATE POLICY delete_oracle_thesis_evidence_links ON public.oracle_thesis_evidence_links
  FOR DELETE TO authenticated, service_role
  USING (
    ((SELECT auth.role()) = 'service_role')
    OR EXISTS (
      SELECT 1 FROM public.oracle_theses ot
      WHERE ot.id = oracle_thesis_evidence_links.thesis_id
        AND ot.profile_id = (SELECT auth.uid())
    )
  );

-- ── oracle_profile_runs: drop raw auth.role(); service writes via TO role ───

DROP POLICY IF EXISTS select_oracle_profile_runs ON public.oracle_profile_runs;
CREATE POLICY select_oracle_profile_runs ON public.oracle_profile_runs
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS insert_oracle_profile_runs ON public.oracle_profile_runs;
CREATE POLICY insert_oracle_profile_runs ON public.oracle_profile_runs
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS update_oracle_profile_runs ON public.oracle_profile_runs;
CREATE POLICY update_oracle_profile_runs ON public.oracle_profile_runs
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS delete_oracle_profile_runs ON public.oracle_profile_runs;
CREATE POLICY delete_oracle_profile_runs ON public.oracle_profile_runs
  FOR DELETE TO service_role
  USING (true);

-- ── oracle_whitespace_core_runs (idempotent 202604060001 shape) ─────────────

DROP POLICY IF EXISTS select_oracle_whitespace_core_runs ON public.oracle_whitespace_core_runs;
CREATE POLICY select_oracle_whitespace_core_runs ON public.oracle_whitespace_core_runs
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS insert_oracle_whitespace_core_runs ON public.oracle_whitespace_core_runs;
CREATE POLICY insert_oracle_whitespace_core_runs ON public.oracle_whitespace_core_runs
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS update_oracle_whitespace_core_runs ON public.oracle_whitespace_core_runs;
CREATE POLICY update_oracle_whitespace_core_runs ON public.oracle_whitespace_core_runs
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS delete_oracle_whitespace_core_runs ON public.oracle_whitespace_core_runs;
CREATE POLICY delete_oracle_whitespace_core_runs ON public.oracle_whitespace_core_runs
  FOR DELETE TO service_role
  USING (true);

-- ── oracle_service_layer_runs (idempotent 202604060001 shape) ───────────────

DROP POLICY IF EXISTS select_oracle_service_layer_runs ON public.oracle_service_layer_runs;
CREATE POLICY select_oracle_service_layer_runs ON public.oracle_service_layer_runs
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS insert_oracle_service_layer_runs ON public.oracle_service_layer_runs;
CREATE POLICY insert_oracle_service_layer_runs ON public.oracle_service_layer_runs
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS update_oracle_service_layer_runs ON public.oracle_service_layer_runs;
CREATE POLICY update_oracle_service_layer_runs ON public.oracle_service_layer_runs
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS delete_oracle_service_layer_runs ON public.oracle_service_layer_runs;
CREATE POLICY delete_oracle_service_layer_runs ON public.oracle_service_layer_runs
  FOR DELETE TO service_role
  USING (true);
