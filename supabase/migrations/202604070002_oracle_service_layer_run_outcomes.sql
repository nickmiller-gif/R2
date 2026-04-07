-- Oracle Slice 11: outcome tracking for service-layer whitespace runs
-- Closes the decision → outcome feedback loop. Records what actually
-- happened after an operator pursue/defer/dismiss decision.

CREATE TABLE oracle_service_layer_run_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oracle_service_layer_run_id uuid NOT NULL UNIQUE
    REFERENCES oracle_service_layer_runs(id) ON DELETE CASCADE,
  outcome_status text NOT NULL
    CHECK (outcome_status IN ('pursued', 'deferred', 'dismissed', 'won', 'lost')),
  outcome_notes text,
  outcome_revenue numeric(18, 2),
  outcome_closed_at timestamp with time zone,
  recorded_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_oracle_service_layer_run_outcomes_run_id
  ON oracle_service_layer_run_outcomes(oracle_service_layer_run_id);
CREATE INDEX idx_oracle_service_layer_run_outcomes_outcome_status
  ON oracle_service_layer_run_outcomes(outcome_status);
CREATE INDEX idx_oracle_service_layer_run_outcomes_created_at
  ON oracle_service_layer_run_outcomes(created_at DESC);

ALTER TABLE oracle_service_layer_run_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_service_layer_run_outcomes ON oracle_service_layer_run_outcomes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY insert_oracle_service_layer_run_outcomes ON oracle_service_layer_run_outcomes
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY update_oracle_service_layer_run_outcomes ON oracle_service_layer_run_outcomes
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY delete_oracle_service_layer_run_outcomes ON oracle_service_layer_run_outcomes
  FOR DELETE TO service_role
  USING (true);
