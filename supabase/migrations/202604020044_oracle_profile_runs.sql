-- Oracle profile runs table
-- Tracks one execution of the Oracle pipeline for a given entity asset.
-- Lifecycle: queued → running → completed | failed | canceled

CREATE TABLE oracle_profile_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_asset_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'canceled')),
  triggered_by text NOT NULL,

  -- Transition timestamps
  started_at timestamp with time zone,
  completed_at timestamp with time zone,

  -- Summary statistics written on completion
  signal_count integer NOT NULL DEFAULT 0,
  top_score numeric,
  summary text,

  -- Extensible metadata
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_oracle_profile_runs_entity_asset_id ON oracle_profile_runs(entity_asset_id);
CREATE INDEX idx_oracle_profile_runs_status ON oracle_profile_runs(status);
CREATE INDEX idx_oracle_profile_runs_created_at ON oracle_profile_runs(created_at DESC);

-- Row-Level Security
ALTER TABLE oracle_profile_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_profile_runs ON oracle_profile_runs
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY insert_oracle_profile_runs ON oracle_profile_runs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY update_oracle_profile_runs ON oracle_profile_runs
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY delete_oracle_profile_runs ON oracle_profile_runs
  FOR DELETE
  USING (auth.role() = 'service_role');
