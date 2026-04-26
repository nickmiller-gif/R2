-- RLS init-plan sweep (batch 3) — Supabase advisor lint 0003.
--
-- Wrap every remaining R2-owned reference to `auth.uid()` / `auth.role()` in
-- `(SELECT ...)` so Postgres evaluates the expression once per statement
-- instead of once per row. Pure perf; the USING / WITH CHECK logic is
-- byte-for-byte equivalent post-wrap.
--
-- Each policy is DROP + CREATE inside a single statement group. DROP IF
-- EXISTS so re-running is safe even if a prior run partially applied.
--
-- Scope: public-schema tables R2 owns. `works.*` + `public.retreat_*` +
-- `public.qa_*` + `public.photo_*` + `public.session_*` + public bucket
-- policies are excluded here — they belong to other apps in the shared
-- project and should be swept separately by the owning team.

-- ───────────────────────────────────────────────────────────────────────
-- Service-role gatekeepers (these should eventually move to TO service_role;
-- for this pass we only wrap the auth.role() call).
-- ───────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role manages public eigen rate buckets"
  ON public.eigen_public_rate_buckets;
CREATE POLICY "Service role manages public eigen rate buckets"
  ON public.eigen_public_rate_buckets
  FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service role manages eigen site registry"
  ON public.eigen_site_registry;
CREATE POLICY "Service role manages eigen site registry"
  ON public.eigen_site_registry
  FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service role manages eigen policy access grants"
  ON public.eigen_policy_access_grants;
CREATE POLICY "Service role manages eigen policy access grants"
  ON public.eigen_policy_access_grants
  FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service role manages conversation_turn"
  ON public.conversation_turn;
CREATE POLICY "Service role manages conversation_turn"
  ON public.conversation_turn
  FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service role manages conversation_turn_feedback"
  ON public.conversation_turn_feedback;
CREATE POLICY "Service role manages conversation_turn_feedback"
  ON public.conversation_turn_feedback
  FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- ───────────────────────────────────────────────────────────────────────
-- Autonomous runtime member-read policies (auth.role() wrap)
-- ───────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS runtime_state_member_read
  ON public.autonomous_runtime_state;
CREATE POLICY runtime_state_member_read
  ON public.autonomous_runtime_state
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS strategy_weights_member_read
  ON public.autonomous_strategy_weights;
CREATE POLICY strategy_weights_member_read
  ON public.autonomous_strategy_weights
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS learning_outcomes_member_read
  ON public.autonomous_learning_outcomes;
CREATE POLICY learning_outcomes_member_read
  ON public.autonomous_learning_outcomes
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

-- ───────────────────────────────────────────────────────────────────────
-- Oracle whitespace / evidence / hypotheses / verification read policies
-- (auth.uid() wrap inside nested EXISTS clauses).
-- ───────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS select_owsr ON public.oracle_whitespace_runs;
CREATE POLICY select_owsr
  ON public.oracle_whitespace_runs
  FOR SELECT TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR status::text = 'published'
    OR EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text = ANY (ARRAY['operator', 'counsel', 'admin'])
    )
  );

DROP POLICY IF EXISTS select_ore ON public.oracle_run_evidence;
CREATE POLICY select_ore
  ON public.oracle_run_evidence
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.oracle_whitespace_runs owr
      WHERE owr.id = oracle_run_evidence.run_id
        AND (
          owr.created_by = (SELECT auth.uid())
          OR owr.status::text = 'published'
          OR EXISTS (
            SELECT 1
            FROM public.charter_user_roles cur
            WHERE cur.user_id = (SELECT auth.uid())
              AND cur.role::text = ANY (ARRAY['operator', 'counsel', 'admin'])
          )
        )
    )
  );

DROP POLICY IF EXISTS select_orh ON public.oracle_run_hypotheses;
CREATE POLICY select_orh
  ON public.oracle_run_hypotheses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.oracle_whitespace_runs owr
      WHERE owr.id = oracle_run_hypotheses.run_id
        AND (
          owr.created_by = (SELECT auth.uid())
          OR owr.status::text = 'published'
          OR EXISTS (
            SELECT 1
            FROM public.charter_user_roles cur
            WHERE cur.user_id = (SELECT auth.uid())
              AND cur.role::text = ANY (ARRAY['operator', 'counsel', 'admin'])
          )
        )
    )
  );

DROP POLICY IF EXISTS select_vr ON public.verification_results;
CREATE POLICY select_vr
  ON public.verification_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text = ANY (ARRAY['operator', 'counsel', 'admin'])
    )
    OR (
      run_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.oracle_whitespace_runs owr
        WHERE owr.id = verification_results.run_id
          AND owr.status::text = 'published'
      )
    )
  );

DROP POLICY IF EXISTS select_ocl ON public.oracle_calibration_log;
CREATE POLICY select_ocl
  ON public.oracle_calibration_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text = ANY (ARRAY['operator', 'counsel', 'admin'])
    )
  );

-- ───────────────────────────────────────────────────────────────────────
-- Entity graph read policies (auth.uid() wrap inside nested EXISTS clauses).
-- ───────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS select_em ON public.entity_mentions;
CREATE POLICY select_em
  ON public.entity_mentions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.knowledge_chunks kc
      JOIN public.documents d ON d.id = kc.document_id
      WHERE kc.id = entity_mentions.chunk_id
        AND d.owner_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text = ANY (ARRAY['operator', 'counsel', 'admin'])
    )
  );

DROP POLICY IF EXISTS select_er ON public.entity_relations;
CREATE POLICY select_er
  ON public.entity_relations
  FOR SELECT TO authenticated
  USING (
    discovered_in_run_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.oracle_whitespace_runs owr
      WHERE owr.id = entity_relations.discovered_in_run_id
        AND (
          owr.created_by = (SELECT auth.uid())
          OR owr.status::text = 'published'
          OR EXISTS (
            SELECT 1
            FROM public.charter_user_roles cur
            WHERE cur.user_id = (SELECT auth.uid())
              AND cur.role::text = ANY (ARRAY['operator', 'counsel', 'admin'])
          )
        )
    )
  );

-- ───────────────────────────────────────────────────────────────────────
-- Asset-graph auth-user INSERT policies (auth.uid() wrap in WITH CHECK).
--
-- These three tables (asset_relationship, asset_evidence_link,
-- asset_external_identity) were specified for an earlier asset-graph
-- design that has not landed in this project's migration history. The
-- canonical asset-registry tables created in
-- 202604020013_foundation_asset_registry.sql are `asset_registry` and
-- `asset_evidence_links` (plural). To make this migration idempotent
-- and safe to apply on every environment regardless of whether the
-- asset-graph tables exist, each block is wrapped in a DO statement
-- that swallows undefined_table errors. When the tables eventually
-- land in a future migration, this batch will start applying the
-- policies as intended on subsequent runs.
-- ───────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Auth users insert asset_relationship" ON public.asset_relationship';
  EXECUTE 'CREATE POLICY "Auth users insert asset_relationship"
    ON public.asset_relationship
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id)';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Skipping asset_relationship policies; table does not exist';
END $$;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Auth users insert asset_evidence_link" ON public.asset_evidence_link';
  EXECUTE 'CREATE POLICY "Auth users insert asset_evidence_link"
    ON public.asset_evidence_link
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id)';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Skipping asset_evidence_link policies; table does not exist (note: canonical is asset_evidence_links plural)';
END $$;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Auth users insert asset_external_identity" ON public.asset_external_identity';
  EXECUTE 'CREATE POLICY "Auth users insert asset_external_identity"
    ON public.asset_external_identity
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id)';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Skipping asset_external_identity policies; table does not exist';
END $$;
