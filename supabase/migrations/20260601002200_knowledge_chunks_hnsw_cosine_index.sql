-- Fix ANN index opclass for cosine retrieval.
--
-- match_knowledge_chunks orders by embedding <=> query (cosine distance).
-- Production had idx_knowledge_chunks_embedding on vector_ip_ops (inner product),
-- which the planner cannot use for <=>, causing a full-table sort over ~18k rows
-- and statement timeouts on eigen-chat / eigen-chat-public.

DROP INDEX IF EXISTS public.idx_knowledge_chunks_embedding;
DROP INDEX IF EXISTS public.idx_knowledge_chunks_embedding_hnsw;

CREATE INDEX idx_knowledge_chunks_embedding_hnsw
  ON public.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX public.idx_knowledge_chunks_embedding_hnsw IS
  'HNSW cosine ANN for match_knowledge_chunks (embedding <=> query).';
