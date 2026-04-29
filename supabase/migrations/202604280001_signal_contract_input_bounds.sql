-- Input bounds and retry-cap guard for the Signal Contract v1 sink.
--
-- Defense-in-depth behind the validators in
-- packages/r2-signal-contract/src/schema.ts and the body-size cap in
-- supabase/functions/r2-signal-ingest/index.ts. Keep these bounds in sync
-- with SIGNAL_BOUNDS in schema.ts.
--
-- Additive only: existing rows fit within these caps because every row was
-- inserted through the validator which already enforces the upstream limits
-- (summary <= 280 was the only DB-level check until now). The remaining
-- columns are bounded here for the first time.

ALTER TABLE public.platform_feed_items
  ADD CONSTRAINT platform_feed_items_source_system_bounds
    CHECK (length(source_system) > 0 AND length(source_system) <= 64),
  ADD CONSTRAINT platform_feed_items_source_repo_bounds
    CHECK (length(source_repo) > 0 AND length(source_repo) <= 200),
  ADD CONSTRAINT platform_feed_items_source_event_type_bounds
    CHECK (length(source_event_type) > 0 AND length(source_event_type) <= 100),
  ADD CONSTRAINT platform_feed_items_source_signal_key_bounds
    CHECK (length(source_signal_key) > 0 AND length(source_signal_key) <= 320),
  ADD CONSTRAINT platform_feed_items_payload_bounds
    CHECK (octet_length(payload::text) <= 65536),
  ADD CONSTRAINT platform_feed_items_provenance_bounds
    CHECK (octet_length(provenance::text) <= 8192),
  ADD CONSTRAINT platform_feed_items_routing_targets_bounds
    CHECK (cardinality(routing_targets) <= 16),
  ADD CONSTRAINT platform_feed_items_related_entity_ids_bounds
    CHECK (cardinality(related_entity_ids) <= 100),
  ADD CONSTRAINT platform_feed_items_error_bounds
    CHECK (error IS NULL OR length(error) <= 2000),
  ADD CONSTRAINT platform_feed_items_attempt_count_nonnegative
    CHECK (attempt_count >= 0);

-- Cap retry attempts so a poison signal cannot churn the worker forever.
-- The claim helper now refuses to re-claim items past the cap, leaving them
-- on processing_status = 'pending' (or 'failed', if markSignalFailed ran)
-- with attempt_count exposed for manual triage.
CREATE OR REPLACE FUNCTION public.claim_platform_feed_items(p_limit integer DEFAULT 25)
RETURNS SETOF public.platform_feed_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_attempts constant integer := 10;
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT p.id
    FROM public.platform_feed_items p
    WHERE p.processing_status = 'pending'
      AND p.attempt_count < max_attempts
      AND (p.next_retry_at IS NULL OR p.next_retry_at <= now())
    ORDER BY p.ingested_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 25), 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.platform_feed_items p
  SET
    processing_status = 'normalized',
    processed_at = now(),
    attempt_count = p.attempt_count + 1,
    next_retry_at = NULL
  FROM candidate c
  WHERE p.id = c.id
  RETURNING p.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_platform_feed_items(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_platform_feed_items(integer) TO service_role;
