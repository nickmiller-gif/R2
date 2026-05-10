-- pg_cron → net.http_post → Edge `generate-thought-piece` (same project as Eigen).
--
-- Requires Vault secret `generate_thought_piece_cron_bearer` whose value is the
-- raw service-role JWT for this project (same string Edge uses as
-- SUPABASE_SERVICE_ROLE_KEY). Create it in Dashboard → Vault before scheduling.
--
-- After the secret exists, run once in SQL editor:
--   select public.schedule_generate_thought_piece_cron();
--
-- Schedule: 06:00 UTC on odd days of month (1,3,5,…) — approx. every other calendar
-- day. Adjust the cron expression in the function if you need a different cadence.

CREATE OR REPLACE FUNCTION public.schedule_generate_thought_piece_cron()
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
    WHERE name = 'generate_thought_piece_cron_bearer'
      AND NULLIF(BTRIM(decrypted_secret), '') IS NOT NULL
  ) THEN
    RETURN 'skipped_missing_vault_secret_generate_thought_piece_cron_bearer';
  END IF;

  FOR r IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'generate-thought-piece-cron'
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'generate-thought-piece-cron',
    '0 6 */2 * *',
    $cron$
    SELECT net.http_post(
      url := 'https://zudslxucibosjwefojtm.supabase.co/functions/v1/generate-thought-piece',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', concat(
          'Bearer ',
          (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'generate_thought_piece_cron_bearer'
            LIMIT 1
          )
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 180000
    );
    $cron$
  );

  RETURN 'scheduled';
END;
$$;

COMMENT ON FUNCTION public.schedule_generate_thought_piece_cron() IS
  'Registers pg_cron job generate-thought-piece-cron. Requires Vault secret generate_thought_piece_cron_bearer (service-role JWT). Re-run after adding the secret.';

REVOKE ALL ON FUNCTION public.schedule_generate_thought_piece_cron() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_generate_thought_piece_cron() TO postgres;

SELECT public.schedule_generate_thought_piece_cron() AS schedule_generate_thought_piece_cron_result;
