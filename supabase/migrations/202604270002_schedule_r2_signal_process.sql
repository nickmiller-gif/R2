-- Schedule the platform feed processor that advances r2-signal-ingest rows to
-- published. The process token value is provisioned separately in Vault under
-- `r2_signal_process_token` so it is not stored in migration history.

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'r2-signal-process-dispatcher';

SELECT cron.schedule(
  'r2-signal-process-dispatcher',
  '15 seconds',
  $$
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
  $$
);
