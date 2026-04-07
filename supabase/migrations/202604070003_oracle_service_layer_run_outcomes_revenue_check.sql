-- Oracle Slice 11 follow-up: enforce non-negative outcome revenue at the DB layer.

ALTER TABLE oracle_service_layer_run_outcomes
  ADD CONSTRAINT oracle_service_layer_run_outcomes_nonnegative_revenue
  CHECK (outcome_revenue IS NULL OR outcome_revenue >= 0);
