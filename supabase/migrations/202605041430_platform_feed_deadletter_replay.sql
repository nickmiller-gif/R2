-- Terminal deadletter status + manual replay RPC for poison / exhausted signals.
-- Aligns processing_status CHECK with worker logic (see r2-signal-process).

ALTER TABLE public.platform_feed_items
  DROP CONSTRAINT IF EXISTS platform_feed_items_processing_status_check;

ALTER TABLE public.platform_feed_items
  ADD CONSTRAINT platform_feed_items_processing_status_check
  CHECK (
    processing_status IN (
      'pending',
      'normalized',
      'resolved',
      'scored',
      'published',
      'failed',
      'deadletter'
    )
  );

CREATE INDEX IF NOT EXISTS platform_feed_items_deadletter_idx
  ON public.platform_feed_items (ingested_at DESC)
  WHERE processing_status = 'deadletter';

-- Operator/service-role manual replay: resets queue fields so claim_platform_feed_items can pick up again.
CREATE OR REPLACE FUNCTION public.replay_platform_feed_item(p_feed_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.platform_feed_items
  SET
    processing_status = 'pending',
    attempt_count = 0,
    error = NULL,
    next_retry_at = NOW(),
    processed_at = NULL
  WHERE id = p_feed_item_id
    AND processing_status IN ('deadletter', 'failed');
END;
$$;

REVOKE ALL ON FUNCTION public.replay_platform_feed_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replay_platform_feed_item(uuid) TO service_role;
