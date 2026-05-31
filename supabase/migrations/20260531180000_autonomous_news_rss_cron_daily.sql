-- Throttle autonomous-news-rss-cron from hourly to daily.
--
-- The hourly cadence (15 * * * *) emitted ~24 `futuristic_upgrade_scouted`
-- "Bot upgrade" signals per day, which dominated the operator + home feeds and
-- buried the content (properties, IP, clients, people, REGENT opinions). Once a
-- day at 13:15 UTC keeps upgrade scouting alive without flooding the surfaces.
-- Idempotent: unschedules both the legacy hourly job and any prior daily job.

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
    WHERE jobname IN ('autonomous-news-rss-cron-hourly', 'autonomous-news-rss-cron-daily')
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'autonomous-news-rss-cron-daily',
    '15 13 * * *',
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
