-- EigenX Knowledge Chunks
-- Hierarchical document chunks with authority/freshness scoring

CREATE TYPE chunk_level AS ENUM ('document', 'section', 'paragraph', 'claim');

CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_chunk_id UUID REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
  chunk_level chunk_level NOT NULL,
  heading_path JSONB NOT NULL DEFAULT '[]'::jsonb,
  entity_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  policy_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  authority_score INTEGER NOT NULL DEFAULT 50,
  freshness_score INTEGER NOT NULL DEFAULT 100,
  provenance_completeness INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding_version TEXT,
  ingestion_run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_chunks_document_id ON knowledge_chunks(document_id);
CREATE INDEX idx_knowledge_chunks_parent_chunk_id ON knowledge_chunks(parent_chunk_id);
CREATE INDEX idx_knowledge_chunks_chunk_level ON knowledge_chunks(chunk_level);
CREATE INDEX idx_knowledge_chunks_authority_score ON knowledge_chunks(authority_score);
CREATE INDEX idx_knowledge_chunks_ingestion_run_id ON knowledge_chunks(ingestion_run_id);

-- Row-Level Security
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read knowledge chunks for their documents"
  ON knowledge_chunks FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert knowledge chunks for their documents"
  ON knowledge_chunks FOR INSERT
  WITH CHECK (
    document_id IN (
      SELECT id FROM documents WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update knowledge chunks for their documents"
  ON knowledge_chunks FOR UPDATE
  USING (
    document_id IN (
      SELECT id FROM documents WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete knowledge chunks for their documents"
  ON knowledge_chunks FOR DELETE
  USING (
    document_id IN (
      SELECT id FROM documents WHERE owner_id = auth.uid()
    )
  );
