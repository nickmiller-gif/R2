-- Add deterministic idempotency for public intake retries.
-- Applied after 20260512030043_r2community_access_requests.sql.

ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS access_requests_idempotency_key_uidx
  ON public.access_requests (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
;
