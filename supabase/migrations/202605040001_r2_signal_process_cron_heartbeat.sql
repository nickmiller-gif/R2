-- Ensure r2-signal-process runs on a steady heartbeat with claim batch aligned
-- to the edge function cap (25). Replaces any prior dispatcher job so upgrades
-- pick up schedule + URL changes (first migration no-oped when jobname existed).
--
-- Requires: pg_cron, pg_net, Vault secret `r2_signal_process_token` (value must
-- match Edge secret R2_SIGNAL_PROCESS_TOKEN). Pitfall: keep net.http_post body
-- as static jsonb (no shell interpolation) to avoid zsh/cron payload parsing issues.

DO $$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'Skipping r2-signal-process-dispatcher reschedule; pg_cron extension not installed.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
    RAISE NOTICE 'Skipping r2-signal-process-dispatcher reschedule; pg_net / net schema not available (net.http_post unavailable).';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'r2_signal_process_token'
      AND NULLIF(BTRIM(decrypted_secret), '') IS NOT NULL
  ) THEN
    RAISE NOTICE 'Skipping r2-signal-process-dispatcher reschedule; missing Vault secret r2_signal_process_token.';
    RETURN;
  END IF;

  FOR r IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'r2-signal-process-dispatcher'
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;

  -- Sub-minute schedule: highest cadence commonly used on Supabase pg_cron for
  -- HTTP dispatchers (see Supabase Cron / pg_cron docs). Tune down if ops sees excess load.
  PERFORM cron.schedule(
    'r2-signal-process-dispatcher',
    '15 seconds',
    $cron$
    SELECT net.http_post(
      url := 'https://zudslxucibosjwefojtm.supabase.co/functions/v1/r2-signal-process?limit=25',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-r2-signal-process-token', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'r2_signal_process_token'
          LIMIT 1
        )
      ),
      body := jsonb_build_object(
        'source', 'pg_cron',
        'scheduled_at', now()
      ),
      timeout_milliseconds := 25000
    );
    $cron$
  );
END;
$$;
