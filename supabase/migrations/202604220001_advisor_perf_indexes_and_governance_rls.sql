-- Performance + RLS hygiene from Supabase advisor pass (Apr 2026).
-- Non-destructive cleanup + optimization: FK-covering indexes, drop duplicate graph-job index,
-- fix auth_rls_initplan on eigen governance audit read. (Includes guarded DROP INDEX / DROP POLICY.)

-- Duplicate identical indexes on oracle_graph_extraction_jobs (advisor lint 0009)
DROP INDEX IF EXISTS public.idx_oracle_graph_jobs_status_priority_created;

CREATE INDEX IF NOT EXISTS idx_autonomous_learning_outcomes_run_id
  ON public.autonomous_learning_outcomes (run_id);

CREATE INDEX IF NOT EXISTS idx_autonomous_runtime_state_updated_by
  ON public.autonomous_runtime_state (updated_by);

CREATE INDEX IF NOT EXISTS idx_eigen_chat_turns_retrieval_run_id
  ON public.eigen_chat_turns (retrieval_run_id);

CREATE INDEX IF NOT EXISTS idx_eigen_governance_audit_log_actor_id
  ON public.eigen_governance_audit_log (actor_id);

CREATE INDEX IF NOT EXISTS idx_oracle_calibration_log_run_id
  ON public.oracle_calibration_log (run_id);

-- Preview branches may lag migrations that add core_run_id; only index when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'oracle_whitespace_runs'
      AND column_name = 'core_run_id'
  ) THEN
    EXECUTE
      'CREATE INDEX IF NOT EXISTS idx_oracle_whitespace_runs_core_run_id ON public.oracle_whitespace_runs (core_run_id)';
  END IF;
END $$;

-- RLS: wrap auth.uid() so Postgres evaluates it once per statement (initplan optimization)
DROP POLICY IF EXISTS select_eigen_governance_audit_log ON public.eigen_governance_audit_log;
CREATE POLICY select_eigen_governance_audit_log ON public.eigen_governance_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );
