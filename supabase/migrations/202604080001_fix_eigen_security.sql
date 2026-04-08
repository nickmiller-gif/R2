-- Eigen Security Hardening
-- Fixes identified in code review:
-- 1. Enable pg_net extension (required by dispatch_embedding_jobs)
-- 2. Remove hardcoded project URL fallback; fail fast when settings missing
-- 3. Restrict pgmq_delete EXECUTE to service_role (was PUBLIC)
-- 4. Reject NULL filter_owner_id in hybrid_search to prevent cross-tenant exfiltration

-- 1. Enable pg_net (used by dispatch_embedding_jobs for http_post)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Redefine dispatch_embedding_jobs — remove hardcoded URL, fail fast on missing config
CREATE OR REPLACE FUNCTION public.dispatch_embedding_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
DECLARE
  batch jsonb;
  msgs jsonb;
  supabase_url text;
  service_key text;
BEGIN
  -- Read up to 10 messages with 60s visibility timeout
  SELECT jsonb_agg(to_jsonb(m))
  INTO msgs
  FROM pgmq.read('embedding_jobs', 60, 10) m;

  -- Nothing to process
  IF msgs IS NULL OR jsonb_array_length(msgs) = 0 THEN
    RETURN;
  END IF;

  -- Build payload with message IDs and job data
  batch := jsonb_build_object('messages', msgs);

  -- Read secrets from runtime settings
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key  := current_setting('app.settings.service_role_key', true);

  -- Fail fast when dispatcher settings are missing so messages remain in the queue
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE WARNING 'dispatch_embedding_jobs skipped: app.settings.supabase_url is not configured';
    RETURN;
  END IF;

  IF service_key IS NULL OR service_key = '' THEN
    RAISE WARNING 'dispatch_embedding_jobs skipped: app.settings.service_role_key is not configured';
    RETURN;
  END IF;

  -- Dispatch to Edge Function via pg_net
  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/embed-chunks',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := batch
  );
END;
$$;

-- 3. Restrict pgmq_delete: revoke PUBLIC execute, grant only to service_role
-- (The function is SECURITY DEFINER, so unrestricted PUBLIC access lets any DB
--  role delete arbitrary messages from any queue.)
REVOKE EXECUTE ON FUNCTION public.pgmq_delete(text, bigint) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pgmq_delete(text, bigint) TO service_role;

-- 4. Redefine hybrid_search — reject NULL filter_owner_id to prevent cross-tenant
--    data exfiltration (SECURITY DEFINER bypasses RLS so filtering must be explicit)
CREATE OR REPLACE FUNCTION public.hybrid_search(
  query_text        text,
  query_embedding   extensions.vector(1536),
  match_count       int     DEFAULT 10,
  filter_owner_id   uuid    DEFAULT NULL,
  full_text_weight  float   DEFAULT 1.0,
  semantic_weight   float   DEFAULT 1.0,
  rrf_k             int     DEFAULT 50
)
RETURNS TABLE (
  id              uuid,
  content         text,
  chunk_level     text,
  authority_score int,
  freshness_score int,
  document_id     uuid,
  heading_path    jsonb,
  entity_ids      jsonb,
  score           float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
BEGIN
  -- Require filter_owner_id: the function runs as SECURITY DEFINER (bypasses RLS),
  -- so passing NULL would expose all owners' data to any caller with EXECUTE.
  IF filter_owner_id IS NULL THEN
    RAISE EXCEPTION 'filter_owner_id is required — pass the authenticated user''s id';
  END IF;

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
      AND d.owner_id = filter_owner_id
    LIMIT LEAST(match_count, 30) * 2
  ),
  semantic AS (
    SELECT
      kc.id,
      ROW_NUMBER() OVER (
        ORDER BY kc.embedding <#> query_embedding
      ) AS rank_ix
    FROM public.knowledge_chunks kc
    JOIN public.documents d ON d.id = kc.document_id
    WHERE kc.embedding IS NOT NULL
      AND d.owner_id = filter_owner_id
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
  'SECURITY DEFINER to bypass RLS — filter_owner_id is required and enforced explicitly.';
