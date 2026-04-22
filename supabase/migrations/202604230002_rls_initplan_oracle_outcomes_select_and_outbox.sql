-- RLS initplan follow-up: oracle_outcomes SELECT (explicit TO authenticated) and eigen_oracle_outbox
-- service-role policies use (SELECT auth.role()) per Supabase lint 0003.
-- Remote schema_migrations version aligned to this filename (was 20260422010843 from MCP apply).

-- ── oracle_outcomes ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS select_oracle_outcomes ON public.oracle_outcomes;
CREATE POLICY select_oracle_outcomes ON public.oracle_outcomes
  FOR SELECT TO authenticated
  USING (true);

-- ── eigen_oracle_outbox ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role can read oracle outbox" ON public.eigen_oracle_outbox;
CREATE POLICY "Service role can read oracle outbox" ON public.eigen_oracle_outbox
  FOR SELECT
  USING ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service role can insert oracle outbox" ON public.eigen_oracle_outbox;
CREATE POLICY "Service role can insert oracle outbox" ON public.eigen_oracle_outbox
  FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service role can update oracle outbox" ON public.eigen_oracle_outbox;
CREATE POLICY "Service role can update oracle outbox" ON public.eigen_oracle_outbox
  FOR UPDATE
  USING ((SELECT auth.role()) = 'service_role');
