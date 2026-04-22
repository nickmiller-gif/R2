-- RLS initplan follow-up: oracle_outcomes SELECT (explicit TO authenticated); eigen_oracle_outbox
-- interim policies (then superseded by 202604230003 for TO service_role). Two files because 002
-- may already be applied on preview/prod before 003 landed—same DROP/CREATE policy pattern as 202604030003.

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
