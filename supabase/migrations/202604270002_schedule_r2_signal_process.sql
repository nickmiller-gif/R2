-- Schedule the platform feed processor that advances r2-signal-ingest rows to
-- published. The process token value is provisioned separately in Vault under
-- `r2_signal_process_token` so it is not stored in migration history.
--
-- Preview branches may not have pg_cron installed or operational Vault
-- secrets. In either case, leave scheduling to the environment bootstrap
-- instead of installing a broken job.

DO $$
BEGIN
  -- Preview branches without pg_cron installed: the `cron` schema does not
  -- exist, so any reference to `cron.job` errors before runtime. Skip
  -- cleanly so the migration does not fail the entire branch deploy.
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'Skipping r2-signal-process-dispatcher schedule; pg_cron extension not installed.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'r2-signal-process-dispatcher'
  ) THEN
    RAISE NOTICE 'Cron job r2-signal-process-dispatcher already exists; leaving it unchanged.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'r2_signal_process_token'
      AND NULLIF(BTRIM(decrypted_secret), '') IS NOT NULL
  ) THEN
    RAISE NOTICE 'Skipping r2-signal-process-dispatcher schedule; missing Vault secret r2_signal_process_token.';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'r2-signal-process-dispatcher',
    '15 seconds',
    $cron$
    SELECT net.http_post(
      url := 'https://zudslxucibosjwefojtm.supabase.co/functions/v1/r2-signal-process?limit=15',
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
