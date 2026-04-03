-- Oracle Outcomes — real-world result tracking for thesis validation
-- Closes Gap #3: theses can now be scored against actual outcomes.

CREATE TYPE oracle_outcome_verdict AS ENUM (
  'confirmed',
  'partially_confirmed',
  'refuted',
  'inconclusive',
  'pending'
);

CREATE TYPE oracle_outcome_source AS ENUM (
  'manual',
  'automated',
  'external_feed',
  'domain_event'
);

CREATE TABLE oracle_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id UUID NOT NULL REFERENCES oracle_theses(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verdict oracle_outcome_verdict NOT NULL DEFAULT 'pending',
  outcome_source oracle_outcome_source NOT NULL DEFAULT 'manual',
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT NOT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  accuracy_score NUMERIC,
  confidence_delta NUMERIC,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oracle_outcomes_thesis_id ON oracle_outcomes(thesis_id);
CREATE INDEX idx_oracle_outcomes_profile_id ON oracle_outcomes(profile_id);
CREATE INDEX idx_oracle_outcomes_verdict ON oracle_outcomes(verdict);
CREATE INDEX idx_oracle_outcomes_observed_at ON oracle_outcomes(observed_at DESC);
CREATE INDEX idx_oracle_outcomes_created_at ON oracle_outcomes(created_at DESC);

ALTER TABLE oracle_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_outcomes ON oracle_outcomes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_oracle_outcomes ON oracle_outcomes
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR profile_id = auth.uid());

CREATE POLICY update_oracle_outcomes ON oracle_outcomes
  FOR UPDATE
  USING (auth.role() = 'service_role' OR profile_id = auth.uid())
  WITH CHECK (auth.role() = 'service_role' OR profile_id = auth.uid());

CREATE POLICY delete_oracle_outcomes ON oracle_outcomes
  FOR DELETE
  USING (auth.role() = 'service_role' OR profile_id = auth.uid());
