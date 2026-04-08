-- Standalone Eigen phase 1 retrieval + Oracle enrichment placeholders

ALTER TABLE knowledge_chunks
ADD COLUMN oracle_signal_id UUID,
ADD COLUMN oracle_relevance_score INTEGER;

ALTER TABLE retrieval_runs
ADD COLUMN oracle_context JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX idx_knowledge_chunks_oracle_signal_id ON knowledge_chunks(oracle_signal_id);
CREATE INDEX idx_knowledge_chunks_oracle_relevance_score ON knowledge_chunks(oracle_relevance_score);
