-- Standalone Eigen phase 0 foundation:
-- 1) embeddings + ANN index on knowledge_chunks
-- 2) Oracle preservation outbox (append-only)

ALTER TABLE knowledge_chunks
ADD COLUMN embedding extensions.vector(1536);

CREATE INDEX idx_knowledge_chunks_embedding_hnsw
ON knowledge_chunks
USING hnsw (embedding extensions.vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE TABLE eigen_oracle_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  source_system TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  correlation_id TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  oracle_signal_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oracle_outbox_status ON eigen_oracle_outbox(status);
CREATE INDEX idx_oracle_outbox_source ON eigen_oracle_outbox(source_system, source_ref);
CREATE INDEX idx_oracle_outbox_created_at ON eigen_oracle_outbox(created_at DESC);

ALTER TABLE eigen_oracle_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can read oracle outbox"
  ON eigen_oracle_outbox FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can insert oracle outbox"
  ON eigen_oracle_outbox FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update oracle outbox"
  ON eigen_oracle_outbox FOR UPDATE
  USING (auth.role() = 'service_role');
