-- pgmq Embedding Pipeline
-- Transactional outbox pattern: knowledge_chunk insert/update → pgmq queue →
-- pg_cron dispatches batch to embed-chunks Edge Function via pg_net.
-- At-least-once delivery with idempotency tracking in the consumer.

-- 1. Enable pgmq and pg_cron extensions
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the embedding jobs queue
SELECT pgmq.create('embedding_jobs');

-- 3. Idempotency tracking — consumer marks processed chunk+version pairs
CREATE TABLE public.embedding_job_log (
  chunk_id uuid NOT NULL,
  content_hash text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  embedding_model text NOT NULL DEFAULT 'text-embedding-3-small',
  PRIMARY KEY (chunk_id, content_hash)
);

ALTER TABLE public.embedding_job_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY embedding_job_log_service_role ON public.embedding_job_log
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.embedding_job_log IS
  'Idempotency log for the embedding pipeline. Tracks which chunk+content_hash '
  'pairs have been embedded to prevent duplicate work under at-least-once delivery.';

-- 4. Trigger function: enqueue embedding job when a chunk is created or content changes
CREATE OR REPLACE FUNCTION public.enqueue_embedding_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
BEGIN
  -- Only enqueue if this is an INSERT, or content actually changed on UPDATE
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.content_hash <> OLD.content_hash) THEN
    PERFORM pgmq.send(
      queue_name := 'embedding_jobs',
      msg := jsonb_build_object(
        'chunk_id', NEW.id,
        'document_id', NEW.document_id,
        'content_hash', NEW.content_hash,
        'chunk_level', NEW.chunk_level,
        'op', TG_OP
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER knowledge_chunks_enqueue_embedding
  AFTER INSERT OR UPDATE ON public.knowledge_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_embedding_job();

-- 5. Dispatcher function: reads batch from queue, sends to Edge Function via pg_net
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
  batch := jsonb_build_object(
    'messages', msgs
  );

  -- Read secrets from vault or env
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);

  -- If settings aren't available, try direct config
  IF supabase_url IS NULL OR supabase_url = '' THEN
    -- Fallback: hardcoded project URL (safe — this is the project's own URL)
    supabase_url := 'https://zudslxucibosjwefojtm.supabase.co';
  END IF;

  -- Dispatch to Edge Function via pg_net
  IF service_key IS NOT NULL AND service_key <> '' THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/embed-chunks',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := batch
    );
  END IF;
END;
$$;

-- 6. Wrapper for pgmq.delete — exposes it in the public schema for PostgREST RPC
CREATE OR REPLACE FUNCTION public.pgmq_delete(queue_name text, msg_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, msg_id);
END;
$$;

-- 7. Schedule dispatcher to run every 10 seconds
SELECT cron.schedule(
  'dispatch-embedding-jobs',
  '10 seconds',
  $$SELECT public.dispatch_embedding_jobs()$$
);
