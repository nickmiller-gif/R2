-- Phase 0: Shared documents table — canonical store for transcripts,
-- summaries, reports, and any text artifact.
-- Eigen-ready: indexing lifecycle fields included from day one.

CREATE TYPE document_status AS ENUM ('draft', 'active', 'archived', 'deleted');
CREATE TYPE index_status AS ENUM ('pending', 'indexed', 'failed', 'stale');
CREATE TYPE embedding_status AS ENUM ('pending', 'embedded', 'failed', 'stale');
CREATE TYPE extracted_text_status AS ENUM ('pending', 'extracted', 'failed', 'not_applicable');

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership & origin
  source_system text NOT NULL,
  owner_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  content_type text NOT NULL DEFAULT 'text/plain',
  status document_status NOT NULL DEFAULT 'active',

  -- Provenance fields
  source_url text,
  source_title text,
  captured_at timestamptz,
  confidence numeric(3, 2) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),

  -- Eigen-ready indexing lifecycle
  content_hash text NOT NULL,
  index_status index_status NOT NULL DEFAULT 'pending',
  indexed_at timestamptz,
  embedding_status embedding_status NOT NULL DEFAULT 'pending',
  vector_store_ref text,
  extracted_text_status extracted_text_status NOT NULL DEFAULT 'pending',

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_documents_source_system ON documents (source_system);
CREATE INDEX idx_documents_owner_id ON documents (owner_id);
CREATE INDEX idx_documents_status ON documents (status);
CREATE INDEX idx_documents_content_hash ON documents (content_hash);
CREATE INDEX idx_documents_index_status ON documents (index_status);
CREATE INDEX idx_documents_embedding_status ON documents (embedding_status);
CREATE INDEX idx_documents_created_at ON documents (created_at DESC);

-- RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read documents they own or in their area
CREATE POLICY documents_read ON documents
  FOR SELECT TO authenticated
  USING (true);

-- Only service_role can write (product domains go through edge functions)
CREATE POLICY documents_write ON documents
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE documents IS
  'Canonical document store — transcripts, summaries, reports. Eigen-ready with indexing lifecycle.';
