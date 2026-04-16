-- Governance audit log for Eigen/EigenX publication and calibration events.
-- Adds an immutable event stream so operator decisions are traceable.

CREATE TABLE IF NOT EXISTS eigen_governance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (
    event_type IN (
      'run_review_ready',
      'run_published',
      'hypothesis_published',
      'outcome_recorded'
    )
  ),
  run_id uuid REFERENCES oracle_whitespace_runs(id) ON DELETE SET NULL,
  thesis_id uuid REFERENCES oracle_theses(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eigen_governance_audit_event_created
  ON eigen_governance_audit_log(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eigen_governance_audit_run
  ON eigen_governance_audit_log(run_id)
  WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eigen_governance_audit_thesis
  ON eigen_governance_audit_log(thesis_id)
  WHERE thesis_id IS NOT NULL;

ALTER TABLE eigen_governance_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_eigen_governance_audit_log ON eigen_governance_audit_log;
CREATE POLICY select_eigen_governance_audit_log ON eigen_governance_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = auth.uid()
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS insert_eigen_governance_audit_log ON eigen_governance_audit_log;
CREATE POLICY insert_eigen_governance_audit_log ON eigen_governance_audit_log
  FOR INSERT TO service_role
  WITH CHECK (true);

