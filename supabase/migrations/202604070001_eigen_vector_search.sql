-- Eigen Vector Search Foundation
-- Adds embedding storage, full-text search, HNSW index, and hybrid search
-- function to knowledge_chunks for the Oracle/EigenX retrieval pipeline.

-- 1. Add embedding column (nullable — chunks exist before embedding generation)
ALTER TABLE knowledge_chunks
  ADD COLUMN embedding extensions.vector(1536);

-- 2. Add generated tsvector column for full-text search
ALTER TABLE knowledge_chunks
  ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- 3. HNSW index for semantic similarity search
-- vector_ip_ops: inner product is correct for normalized embeddings (OpenAI, Cohere)
-- Safe to create on empty/sparse column — HNSW needs no training data
CREATE INDEX idx_knowledge_chunks_embedding
  ON knowledge_chunks USING hnsw (embedding extensions.vector_ip_ops)
  WITH (m = 24, ef_construction = 64);

-- 4. GIN index for full-text search
CREATE INDEX idx_knowledge_chunks_fts
  ON knowledge_chunks USING gin (fts);

-- 5. Hybrid search function combining semantic + full-text retrieval with RRF fusion
-- Uses plpgsql so the function body is parsed at runtime (when search_path includes
-- the extensions schema), not at creation time when pgvector operators aren't visible.
CREATE OR REPLACE FUNCTION public.hybrid_search(
  query_text text,
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 10,
  filter_owner_id uuid DEFAULT NULL,
  full_text_weight float DEFAULT 1.0,
  semantic_weight float DEFAULT 1.0,
  rrf_k int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  content text,
  chunk_level text,
  authority_score int,
  freshness_score int,
  document_id uuid,
  heading_path jsonb,
  entity_ids jsonb,
  score float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
BEGIN
  RETURN QUERY
  WITH full_text AS (
    SELECT
      kc.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(kc.fts, websearch_to_tsquery('english', query_text)) DESC
      ) AS rank_ix
    FROM public.knowledge_chunks kc
    JOIN public.documents d ON d.id = kc.document_id
    WHERE kc.fts @@ websearch_to_tsquery('english', query_text)
      AND (filter_owner_id IS NULL OR d.owner_id = filter_owner_id)
    LIMIT LEAST(match_count, 30) * 2
  ),
  semantic AS (
    SELECT
      kc.id,
      ROW_NUMBER() OVER (
        ORDER BY kc.embedding <#> query_embedding  -- negative inner product distance
      ) AS rank_ix
    FROM public.knowledge_chunks kc
    JOIN public.documents d ON d.id = kc.document_id
    WHERE kc.embedding IS NOT NULL
      AND (filter_owner_id IS NULL OR d.owner_id = filter_owner_id)
    ORDER BY kc.embedding <#> query_embedding
    LIMIT LEAST(match_count, 30) * 2
  )
  SELECT
    kc.id,
    kc.content,
    kc.chunk_level::text,
    kc.authority_score,
    kc.freshness_score,
    kc.document_id,
    kc.heading_path,
    kc.entity_ids,
    (
      COALESCE(1.0 / (rrf_k + ft.rank_ix), 0.0) * full_text_weight +
      COALESCE(1.0 / (rrf_k + sm.rank_ix), 0.0) * semantic_weight
    )::float AS score
  FROM full_text ft
  FULL OUTER JOIN semantic sm ON ft.id = sm.id
  JOIN public.knowledge_chunks kc ON COALESCE(ft.id, sm.id) = kc.id
  ORDER BY score DESC
  LIMIT LEAST(match_count, 30);
END;
$$;

COMMENT ON FUNCTION public.hybrid_search IS
  'Hybrid semantic + full-text search over knowledge_chunks with Reciprocal Rank Fusion. '
  'Use SECURITY DEFINER to bypass RLS cascade — caller passes owner_id for filtering.';
