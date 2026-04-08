-- Standalone Eigen ingestion pipeline telemetry

CREATE TYPE ingestion_run_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  chunking_mode TEXT NOT NULL DEFAULT 'hierarchical',
  embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  chunk_count INTEGER NOT NULL DEFAULT 0,
  status ingestion_run_status NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_system, source_ref)
);

CREATE INDEX idx_ingestion_runs_document_id ON ingestion_runs(document_id);
CREATE INDEX idx_ingestion_runs_status ON ingestion_runs(status);
CREATE INDEX idx_ingestion_runs_created_at ON ingestion_runs(created_at DESC);

ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ingestion runs"
  ON ingestion_runs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can insert ingestion runs"
  ON ingestion_runs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update ingestion runs"
  ON ingestion_runs FOR UPDATE
  USING (auth.role() = 'service_role');
