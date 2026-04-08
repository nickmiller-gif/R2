-- Canonical identity for Eigen-ingested documents: stable (source_system, source_ref) for upserts and retries.

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS source_ref text;

COMMENT ON COLUMN documents.source_ref IS
  'Domain-stable id when set (e.g. analysis_run_id). Unique per source_system for Eigen ingest upserts.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_source_system_source_ref_unique
  ON documents (source_system, source_ref)
  WHERE source_ref IS NOT NULL;
