-- Oracle whitespace core runs table
-- Stores the raw whitespace analysis output for a given entity asset.
-- One row per whitespace analysis execution.

CREATE TABLE oracle_whitespace_core_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_asset_id uuid NOT NULL,
  run_label text NOT NULL,
  analysis_json jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_oracle_whitespace_core_runs_entity ON oracle_whitespace_core_runs(entity_asset_id);
CREATE INDEX idx_oracle_whitespace_core_runs_created ON oracle_whitespace_core_runs(created_at DESC);

-- Row-Level Security
ALTER TABLE oracle_whitespace_core_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_whitespace_core_runs ON oracle_whitespace_core_runs
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY insert_oracle_whitespace_core_runs ON oracle_whitespace_core_runs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY update_oracle_whitespace_core_runs ON oracle_whitespace_core_runs
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY delete_oracle_whitespace_core_runs ON oracle_whitespace_core_runs
  FOR DELETE
  USING (auth.role() = 'service_role');
