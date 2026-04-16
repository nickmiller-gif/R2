-- Oracle WS pipeline persistence schema + scorecards + graph extraction queue.
-- Aligns edge function oracle-ws-pipeline with concrete tables and evaluation hooks.

CREATE TABLE IF NOT EXISTS oracle_whitespace_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  target_entities text[] NOT NULL DEFAULT '{}',
  constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_sources_allowed text[] NOT NULL DEFAULT '{}',
  time_horizon text,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  run_label text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'gathering_evidence', 'resolving_entities', 'generating_hypotheses', 'scoring', 'verification', 'review', 'published', 'failed')
  ),
  evaluation jsonb NOT NULL DEFAULT '{}'::jsonb,
  stage_progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oracle_whitespace_runs_domain ON oracle_whitespace_runs(domain);
CREATE INDEX IF NOT EXISTS idx_oracle_whitespace_runs_status ON oracle_whitespace_runs(status);
CREATE INDEX IF NOT EXISTS idx_oracle_whitespace_runs_created_at ON oracle_whitespace_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS oracle_run_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES oracle_whitespace_runs(id) ON DELETE CASCADE,
  chunk_id uuid,
  source_type text NOT NULL,
  source_ref text NOT NULL,
  source_system text NOT NULL,
  authority_score numeric NOT NULL DEFAULT 0,
  relevance_score numeric NOT NULL DEFAULT 0,
  content_excerpt text,
  provenance_chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oracle_run_evidence_run_id ON oracle_run_evidence(run_id);
CREATE INDEX IF NOT EXISTS idx_oracle_run_evidence_source_system ON oracle_run_evidence(source_system);

CREATE TABLE IF NOT EXISTS oracle_run_hypotheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES oracle_whitespace_runs(id) ON DELETE CASCADE,
  thesis_id uuid REFERENCES oracle_theses(id) ON DELETE SET NULL,
  hypothesis_text text NOT NULL,
  reasoning_trace text,
  novelty_score numeric NOT NULL DEFAULT 0,
  evidence_strength numeric NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0,
  actionability numeric NOT NULL DEFAULT 0,
  composite_score numeric NOT NULL DEFAULT 0,
  citation_ids uuid[] NOT NULL DEFAULT '{}',
  publishable boolean NOT NULL DEFAULT false,
  verification_passed boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oracle_run_hypotheses_run_id ON oracle_run_hypotheses(run_id);
CREATE INDEX IF NOT EXISTS idx_oracle_run_hypotheses_composite_score ON oracle_run_hypotheses(composite_score DESC);

CREATE TABLE IF NOT EXISTS verification_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES oracle_whitespace_runs(id) ON DELETE CASCADE,
  hypothesis_id uuid REFERENCES oracle_run_hypotheses(id) ON DELETE CASCADE,
  claim_text text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('verified', 'partially_verified', 'unverified')),
  consensus_score numeric NOT NULL DEFAULT 0,
  consensus_threshold numeric NOT NULL DEFAULT 0.667,
  sources_checked integer NOT NULL DEFAULT 0,
  sources_agreeing integer NOT NULL DEFAULT 0,
  adversarial_check_run boolean NOT NULL DEFAULT false,
  adversarial_result jsonb,
  verifier_model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_results_run_id ON verification_results(run_id);
CREATE INDEX IF NOT EXISTS idx_verification_results_hypothesis_id ON verification_results(hypothesis_id);

CREATE TABLE IF NOT EXISTS oracle_calibration_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id uuid NOT NULL REFERENCES oracle_theses(id) ON DELETE CASCADE,
  outcome_id uuid NOT NULL REFERENCES oracle_outcomes(id) ON DELETE CASCADE,
  predicted_confidence numeric NOT NULL,
  predicted_evidence_strength numeric NOT NULL,
  actual_verdict text NOT NULL CHECK (actual_verdict IN ('confirmed', 'partially_confirmed', 'refuted', 'inconclusive')),
  accuracy_score numeric NOT NULL,
  calibration_error numeric NOT NULL,
  confidence_delta numeric NOT NULL,
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oracle_calibration_log_thesis_id ON oracle_calibration_log(thesis_id);
CREATE INDEX IF NOT EXISTS idx_oracle_calibration_log_created_at ON oracle_calibration_log(created_at DESC);

CREATE TABLE IF NOT EXISTS oracle_run_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES oracle_whitespace_runs(id) ON DELETE CASCADE,
  model_version text NOT NULL,
  hypothesis_count integer NOT NULL DEFAULT 0,
  published_count integer NOT NULL DEFAULT 0,
  citation_coverage numeric NOT NULL DEFAULT 0,
  novelty_score numeric NOT NULL DEFAULT 0,
  avg_confidence numeric NOT NULL DEFAULT 0,
  avg_evidence_strength numeric NOT NULL DEFAULT 0,
  verified_rate numeric NOT NULL DEFAULT 0,
  evidence_diversity integer NOT NULL DEFAULT 0,
  avg_composite_score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oracle_run_scorecards_run_id ON oracle_run_scorecards(run_id);

CREATE TABLE IF NOT EXISTS oracle_graph_extraction_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES oracle_whitespace_runs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority integer NOT NULL DEFAULT 50,
  trigger text NOT NULL DEFAULT 'pipeline_execute',
  domain text,
  target_entities text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_oracle_graph_jobs_status_priority
  ON oracle_graph_extraction_jobs(status, priority DESC, created_at ASC);

ALTER TABLE oracle_whitespace_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_run_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_run_hypotheses ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_calibration_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_run_scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_graph_extraction_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_whitespace_runs ON oracle_whitespace_runs
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY insert_oracle_whitespace_runs ON oracle_whitespace_runs
  FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY update_oracle_whitespace_runs ON oracle_whitespace_runs
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY select_oracle_run_evidence ON oracle_run_evidence
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY insert_oracle_run_evidence ON oracle_run_evidence
  FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY delete_oracle_run_evidence ON oracle_run_evidence
  FOR DELETE TO service_role
  USING (true);

CREATE POLICY select_oracle_run_hypotheses ON oracle_run_hypotheses
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY insert_oracle_run_hypotheses ON oracle_run_hypotheses
  FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY update_oracle_run_hypotheses ON oracle_run_hypotheses
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);
CREATE POLICY delete_oracle_run_hypotheses ON oracle_run_hypotheses
  FOR DELETE TO service_role
  USING (true);

CREATE POLICY select_verification_results ON verification_results
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY insert_verification_results ON verification_results
  FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY delete_verification_results ON verification_results
  FOR DELETE TO service_role
  USING (true);

CREATE POLICY select_oracle_calibration_log ON oracle_calibration_log
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY insert_oracle_calibration_log ON oracle_calibration_log
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY select_oracle_run_scorecards ON oracle_run_scorecards
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY insert_oracle_run_scorecards ON oracle_run_scorecards
  FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY update_oracle_run_scorecards ON oracle_run_scorecards
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY select_oracle_graph_extraction_jobs ON oracle_graph_extraction_jobs
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY insert_oracle_graph_extraction_jobs ON oracle_graph_extraction_jobs
  FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY update_oracle_graph_extraction_jobs ON oracle_graph_extraction_jobs
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);
