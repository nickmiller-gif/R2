-- Oracle Slice 09: persistence for whitespace core + service-layer run records
-- Adds additive tables used by the oracle-whitespace-runs edge API path.

CREATE TABLE oracle_whitespace_core_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_asset_id uuid NOT NULL,
  run_label text NOT NULL,
  analysis_json jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_oracle_whitespace_core_runs_entity_asset_id
  ON oracle_whitespace_core_runs(entity_asset_id);
CREATE INDEX idx_oracle_whitespace_core_runs_created_at
  ON oracle_whitespace_core_runs(created_at DESC);

ALTER TABLE oracle_whitespace_core_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_whitespace_core_runs ON oracle_whitespace_core_runs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY insert_oracle_whitespace_core_runs ON oracle_whitespace_core_runs
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY update_oracle_whitespace_core_runs ON oracle_whitespace_core_runs
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY delete_oracle_whitespace_core_runs ON oracle_whitespace_core_runs
  FOR DELETE TO service_role
  USING (true);

CREATE TABLE oracle_service_layer_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_asset_id uuid NOT NULL,
  run_label text NOT NULL,
  triggered_by text NOT NULL,
  profile_run_id uuid NOT NULL REFERENCES oracle_profile_runs(id) ON DELETE CASCADE,
  whitespace_run_id uuid REFERENCES oracle_whitespace_core_runs(id) ON DELETE SET NULL,
  status text NOT NULL
    CHECK (status IN ('running', 'completed', 'failed')),
  analysis_json text
    CHECK (analysis_json IS NULL OR analysis_json::jsonb IS NOT NULL),
  error_message text,
  metadata text NOT NULL DEFAULT '{}'
    CHECK (metadata::jsonb IS NOT NULL),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_oracle_service_layer_runs_entity_asset_id
  ON oracle_service_layer_runs(entity_asset_id);
CREATE INDEX idx_oracle_service_layer_runs_profile_run_id
  ON oracle_service_layer_runs(profile_run_id);
CREATE INDEX idx_oracle_service_layer_runs_whitespace_run_id
  ON oracle_service_layer_runs(whitespace_run_id);
CREATE INDEX idx_oracle_service_layer_runs_status
  ON oracle_service_layer_runs(status);
CREATE INDEX idx_oracle_service_layer_runs_created_at
  ON oracle_service_layer_runs(created_at DESC);

ALTER TABLE oracle_service_layer_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_service_layer_runs ON oracle_service_layer_runs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY insert_oracle_service_layer_runs ON oracle_service_layer_runs
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY update_oracle_service_layer_runs ON oracle_service_layer_runs
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY delete_oracle_service_layer_runs ON oracle_service_layer_runs
  FOR DELETE TO service_role
  USING (true);
