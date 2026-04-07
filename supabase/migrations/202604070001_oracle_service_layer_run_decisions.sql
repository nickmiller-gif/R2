-- Oracle Slice 10: persisted operator decisions for service-layer whitespace runs
-- Adds one-decision-per-run durable storage for operator pursue/defer/dismiss state.

CREATE TABLE oracle_service_layer_run_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oracle_service_layer_run_id uuid NOT NULL UNIQUE
    REFERENCES oracle_service_layer_runs(id) ON DELETE CASCADE,
  decision_status text NOT NULL
    CHECK (decision_status IN ('pursue', 'defer', 'dismiss')),
  notes text,
  decided_by text NOT NULL,
  decided_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_oracle_service_layer_run_decisions_decided_at
  ON oracle_service_layer_run_decisions(decided_at DESC);

ALTER TABLE oracle_service_layer_run_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_service_layer_run_decisions ON oracle_service_layer_run_decisions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY insert_oracle_service_layer_run_decisions ON oracle_service_layer_run_decisions
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY update_oracle_service_layer_run_decisions ON oracle_service_layer_run_decisions
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY delete_oracle_service_layer_run_decisions ON oracle_service_layer_run_decisions
  FOR DELETE TO service_role
  USING (true);
