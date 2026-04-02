-- EigenX Retrieval Runs
-- Telemetry for retrieval operations

CREATE TYPE retrieval_run_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE retrieval_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT NOT NULL,
  decomposition JSONB NOT NULL DEFAULT '{}'::jsonb,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  filtered_count INTEGER NOT NULL DEFAULT 0,
  final_count INTEGER NOT NULL DEFAULT 0,
  budget_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  dropped_context_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status retrieval_run_status NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_retrieval_runs_query_hash ON retrieval_runs(query_hash);
CREATE INDEX idx_retrieval_runs_status ON retrieval_runs(status);
CREATE INDEX idx_retrieval_runs_created_at ON retrieval_runs(created_at DESC);

-- Row-Level Security
ALTER TABLE retrieval_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read retrieval runs"
  ON retrieval_runs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert retrieval runs"
  ON retrieval_runs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update retrieval runs"
  ON retrieval_runs FOR UPDATE
  USING (auth.role() = 'authenticated');
