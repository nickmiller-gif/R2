-- Schedule autonomous-regent-review-cron (weekly, Mondays 13:00 UTC).
-- REGENT is the resident operating intelligence: each week it reviews R2's
-- world-state and emits one advisory executive-review signal. Weekly cadence
-- mirrors the concept's Monday Portfolio Operator run.
-- Requires: pg_cron, pg_net. Optional Vault secret autonomous_regent_review_cron_bearer.

DO $$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'Skipping autonomous-regent-review-cron schedule; pg_cron not installed.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
    RAISE NOTICE 'Skipping autonomous-regent-review-cron schedule; pg_net not available.';
    RETURN;
  END IF;

  FOR r IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'autonomous-regent-review-weekly'
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'autonomous-regent-review-weekly',
    '0 13 * * 1',
    $cron$
    SELECT net.http_post(
      url := 'https://zudslxucibosjwefojtm.supabase.co/functions/v1/autonomous-regent-review-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(
          (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'autonomous_regent_review_cron_bearer'
            LIMIT 1
          ),
          ''
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 180000
    );
    $cron$
  );
END;
$$;
