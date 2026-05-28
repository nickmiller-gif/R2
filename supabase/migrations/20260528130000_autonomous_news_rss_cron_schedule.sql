-- Schedule autonomous-news-rss-cron for KB-four upgrade scouting (hourly at :15).
-- Requires: pg_cron, pg_net. Optional Vault secret autonomous_news_cron_bearer.

DO $$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'Skipping autonomous-news-rss-cron schedule; pg_cron extension not installed.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
    RAISE NOTICE 'Skipping autonomous-news-rss-cron schedule; pg_net not available.';
    RETURN;
  END IF;

  FOR r IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'autonomous-news-rss-cron-hourly'
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'autonomous-news-rss-cron-hourly',
    '15 * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://zudslxucibosjwefojtm.supabase.co/functions/v1/autonomous-news-rss-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(
          (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'autonomous_news_cron_bearer'
            LIMIT 1
          ),
          ''
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
    $cron$
  );
END;
$$;
