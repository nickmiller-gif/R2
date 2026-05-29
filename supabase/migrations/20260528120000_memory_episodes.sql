-- E3: Memory consolidation episodes for long operator chats.
-- Raw memory_entries and eigen_chat_turns remain authoritative; episodes are compact recall summaries.

CREATE TABLE public.memory_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  scope memory_scope NOT NULL DEFAULT 'session',
  session_id UUID REFERENCES public.eigen_chat_sessions(id) ON DELETE CASCADE,
  entity_ids UUID[] NOT NULL DEFAULT '{}',
  topic_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  turn_count INTEGER NOT NULL DEFAULT 0,
  source_turn_ids UUID[] NOT NULL DEFAULT '{}',
  source_entry_ids UUID[] NOT NULL DEFAULT '{}',
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT memory_episodes_summary_nonempty CHECK (char_length(trim(summary)) > 0),
  CONSTRAINT memory_episodes_turn_count_nonnegative CHECK (turn_count >= 0),
  UNIQUE (owner_id, scope, topic_key)
);

CREATE INDEX idx_memory_episodes_owner_scope ON public.memory_episodes(owner_id, scope);
CREATE INDEX idx_memory_episodes_session_id ON public.memory_episodes(session_id);
CREATE INDEX idx_memory_episodes_entity_ids ON public.memory_episodes USING GIN (entity_ids);
CREATE INDEX idx_memory_episodes_window_end ON public.memory_episodes(window_end DESC);

ALTER TABLE public.memory_episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own memory episodes"
  ON public.memory_episodes FOR SELECT
  USING (owner_id = auth.uid());

COMMENT ON TABLE public.memory_episodes IS
  'Consolidated chat memory summaries clustered by session or entity topic; preferred over raw last-turn recall.';

-- pg_cron → eigen-memory-episodes consolidate (requires Vault secret eigen_memory_episodes_cron_bearer).
CREATE OR REPLACE FUNCTION public.schedule_eigen_memory_episodes_cron()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net, vault
AS $$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RETURN 'skipped_no_pg_cron';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
    RETURN 'skipped_no_net';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'eigen_memory_episodes_cron_bearer'
      AND NULLIF(BTRIM(decrypted_secret), '') IS NOT NULL
  ) THEN
    RETURN 'skipped_missing_vault_secret_eigen_memory_episodes_cron_bearer';
  END IF;

  FOR r IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'eigen-memory-episodes-cron'
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'eigen-memory-episodes-cron',
    '15 4 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://zudslxucibosjwefojtm.supabase.co/functions/v1/eigen-memory-episodes-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', concat(
          'Bearer ',
          (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'eigen_memory_episodes_cron_bearer'
            LIMIT 1
          )
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
    $cron$
  );

  RETURN 'scheduled';
END;
$$;

COMMENT ON FUNCTION public.schedule_eigen_memory_episodes_cron() IS
  'Registers pg_cron job eigen-memory-episodes-cron. Requires Vault secret eigen_memory_episodes_cron_bearer.';

REVOKE ALL ON FUNCTION public.schedule_eigen_memory_episodes_cron() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_eigen_memory_episodes_cron() TO postgres;

SELECT public.schedule_eigen_memory_episodes_cron() AS schedule_eigen_memory_episodes_cron_result;
