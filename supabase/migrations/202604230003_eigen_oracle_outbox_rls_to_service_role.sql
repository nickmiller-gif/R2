-- eigen_oracle_outbox: scope service-role policies with TO service_role (no auth.role()).
-- Aligns with 202604030003_optimize_rls_initplan_policies.sql and Copilot review on #147.
-- DROP POLICY + CREATE POLICY is the supported way to change RLS policy definitions in Postgres.

DROP POLICY IF EXISTS "Service role can read oracle outbox" ON public.eigen_oracle_outbox;
CREATE POLICY "Service role can read oracle outbox" ON public.eigen_oracle_outbox
  FOR SELECT TO service_role
  USING (true);

DROP POLICY IF EXISTS "Service role can insert oracle outbox" ON public.eigen_oracle_outbox;
CREATE POLICY "Service role can insert oracle outbox" ON public.eigen_oracle_outbox
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update oracle outbox" ON public.eigen_oracle_outbox;
CREATE POLICY "Service role can update oracle outbox" ON public.eigen_oracle_outbox
  FOR UPDATE TO service_role
  USING (true);
