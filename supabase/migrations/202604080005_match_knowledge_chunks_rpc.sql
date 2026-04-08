-- HNSW-backed retrieval: nearest neighbors in SQL, then entity/policy filters on the ANN pool.
-- Inner query uses ORDER BY embedding <=> query so idx_knowledge_chunks_embedding_hnsw is eligible.
-- Returns a single JSON object so telemetry (ann_row_count) is available even when every candidate is filtered out.

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  query_embedding double precision[],
  ann_limit integer,
  filter_entity_ids text[] DEFAULT NULL,
  filter_policy_tags text[] DEFAULT NULL,
  valid_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  payload jsonb;
BEGIN
  WITH ann AS (
    SELECT
      k.id,
      k.document_id,
      k.chunk_level,
      k.heading_path,
      k.entity_ids,
      k.policy_tags,
      k.valid_from,
      k.valid_to,
      k.authority_score,
      k.freshness_score,
      k.provenance_completeness,
      k.content,
      k.ingestion_run_id,
      d.source_system,
      (1 - (k.embedding <=> query_embedding::extensions.vector(1536)))::double precision AS similarity
    FROM public.knowledge_chunks k
    INNER JOIN public.documents d ON d.id = k.document_id
    WHERE k.embedding IS NOT NULL
      AND (k.valid_from IS NULL OR k.valid_from <= valid_at)
      AND (k.valid_to IS NULL OR k.valid_to >= valid_at)
    ORDER BY k.embedding <=> query_embedding::extensions.vector(1536)
    LIMIT ann_limit
  ),
  stats AS (
    SELECT COUNT(*)::integer AS ann_row_count FROM ann
  ),
  passed AS (
    SELECT
      a.id,
      a.document_id,
      a.chunk_level,
      a.heading_path,
      a.entity_ids,
      a.policy_tags,
      a.valid_from,
      a.valid_to,
      a.authority_score,
      a.freshness_score,
      a.provenance_completeness,
      a.content,
      a.ingestion_run_id,
      a.source_system,
      a.similarity
    FROM ann a
    WHERE
      (
        filter_policy_tags IS NULL
        OR COALESCE(array_length(filter_policy_tags, 1), 0) = 0
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(a.policy_tags) AS pt(tag)
          WHERE pt.tag = ANY (filter_policy_tags)
        )
      )
      AND (
        filter_entity_ids IS NULL
        OR COALESCE(array_length(filter_entity_ids, 1), 0) = 0
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(a.entity_ids) AS eid(val)
          WHERE eid.val = ANY (filter_entity_ids)
        )
      )
  ),
  pass_count AS (
    SELECT COUNT(*)::integer AS passed_row_count FROM passed
  ),
  ordered AS (
    SELECT * FROM passed ORDER BY similarity DESC
  )
  SELECT jsonb_build_object(
    'ann_row_count', (SELECT s.ann_row_count FROM stats s),
    'passed_row_count', (SELECT p.passed_row_count FROM pass_count p),
    'chunks',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', o.id,
            'document_id', o.document_id,
            'chunk_level', o.chunk_level,
            'heading_path', o.heading_path,
            'entity_ids', o.entity_ids,
            'policy_tags', o.policy_tags,
            'valid_from', o.valid_from,
            'valid_to', o.valid_to,
            'authority_score', o.authority_score,
            'freshness_score', o.freshness_score,
            'provenance_completeness', o.provenance_completeness,
            'content', o.content,
            'ingestion_run_id', o.ingestion_run_id,
            'source_system', o.source_system,
            'similarity', o.similarity
          )
          ORDER BY o.similarity DESC
        )
        FROM ordered o
      ),
      '[]'::jsonb
    )
  )
  INTO payload;

  RETURN payload;
END;
$$;

COMMENT ON FUNCTION public.match_knowledge_chunks IS
  'Cosine ANN over knowledge_chunks.embedding (HNSW), temporal bounds, then entity/policy overlap on the ANN pool. Returns JSON with chunks and counts.';

REVOKE ALL ON FUNCTION public.match_knowledge_chunks(double precision[], integer, text[], text[], timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(double precision[], integer, text[], text[], timestamptz) TO service_role;
