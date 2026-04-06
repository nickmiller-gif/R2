-- Oracle service layer runs table
-- Orchestration record that ties a profile run and whitespace core run
-- into a single service-layer execution. Lifecycle: running → completed | failed.

CREATE TABLE oracle_service_layer_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_asset_id uuid NOT NULL,
  run_label text NOT NULL,
  triggered_by text NOT NULL,

  -- Foreign keys to upstream runs
  profile_run_id uuid NOT NULL REFERENCES oracle_profile_runs(id),
  whitespace_run_id uuid REFERENCES oracle_whitespace_core_runs(id),

  -- Execution state
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  analysis_json jsonb,
  error_message text,

  -- Extensible metadata
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_oracle_service_layer_runs_entity ON oracle_service_layer_runs(entity_asset_id);
CREATE INDEX idx_oracle_service_layer_runs_status ON oracle_service_layer_runs(status);
CREATE INDEX idx_oracle_service_layer_runs_profile ON oracle_service_layer_runs(profile_run_id);
CREATE INDEX idx_oracle_service_layer_runs_whitespace ON oracle_service_layer_runs(whitespace_run_id);
CREATE INDEX idx_oracle_service_layer_runs_created ON oracle_service_layer_runs(created_at DESC);

-- Row-Level Security
ALTER TABLE oracle_service_layer_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_service_layer_runs ON oracle_service_layer_runs
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY insert_oracle_service_layer_runs ON oracle_service_layer_runs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY update_oracle_service_layer_runs ON oracle_service_layer_runs
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY delete_oracle_service_layer_runs ON oracle_service_layer_runs
  FOR DELETE
  USING (auth.role() = 'service_role');
