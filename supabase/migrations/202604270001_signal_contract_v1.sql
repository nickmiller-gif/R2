-- Signal Contract v1 canonical stage-1 sink and worker claim helpers.
-- Additive migration for cross-system signal intake.

CREATE TABLE IF NOT EXISTS public.platform_feed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_version text NOT NULL,
  source_system text NOT NULL,
  source_repo text NOT NULL,
  source_event_type text NOT NULL,
  source_signal_key text NOT NULL,
  actor_meg_entity_id uuid REFERENCES public.meg_entities(id) ON DELETE SET NULL,
  related_entity_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  event_time timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  summary text NOT NULL CHECK (char_length(summary) <= 280),
  payload jsonb NOT NULL,
  confidence numeric(4, 3) CHECK (confidence >= 0 AND confidence <= 1),
  privacy_level text NOT NULL CHECK (privacy_level IN ('public', 'members', 'operator', 'private')),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  routing_targets text[] NOT NULL DEFAULT '{}'::text[],
  ingest_run_id uuid,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (
    processing_status IN ('pending', 'normalized', 'resolved', 'scored', 'published', 'failed')
  ),
  processed_at timestamptz,
  next_retry_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  error text,
  evidence_item_id uuid REFERENCES public.oracle_evidence_items(id) ON DELETE SET NULL,
  thesis_ids uuid[] NOT NULL DEFAULT '{}'::uuid[]
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_feed_items_source_signal_key_ux
  ON public.platform_feed_items (source_signal_key);

CREATE INDEX IF NOT EXISTS platform_feed_items_source_event_idx
  ON public.platform_feed_items (source_system, event_time DESC);

CREATE INDEX IF NOT EXISTS platform_feed_items_actor_idx
  ON public.platform_feed_items (actor_meg_entity_id)
  WHERE actor_meg_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS platform_feed_items_pending_idx
  ON public.platform_feed_items (processing_status, ingested_at)
  WHERE processing_status = 'pending';

CREATE INDEX IF NOT EXISTS platform_feed_items_retry_idx
  ON public.platform_feed_items (next_retry_at)
  WHERE processing_status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS platform_feed_items_routing_idx
  ON public.platform_feed_items USING gin (routing_targets);

CREATE INDEX IF NOT EXISTS platform_feed_items_payload_idx
  ON public.platform_feed_items USING gin (payload);

CREATE INDEX IF NOT EXISTS platform_feed_items_related_entity_ids_idx
  ON public.platform_feed_items USING gin (related_entity_ids);

ALTER TABLE public.platform_feed_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_platform_feed_items ON public.platform_feed_items;
CREATE POLICY select_platform_feed_items ON public.platform_feed_items
  FOR SELECT TO authenticated, service_role
  USING (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS insert_platform_feed_items ON public.platform_feed_items;
CREATE POLICY insert_platform_feed_items ON public.platform_feed_items
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS update_platform_feed_items ON public.platform_feed_items;
CREATE POLICY update_platform_feed_items ON public.platform_feed_items
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS delete_platform_feed_items ON public.platform_feed_items;
CREATE POLICY delete_platform_feed_items ON public.platform_feed_items
  FOR DELETE TO service_role
  USING (true);

CREATE OR REPLACE FUNCTION public.enqueue_platform_feed_processing(signal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.platform_feed_items
  SET
    processing_status = CASE WHEN processing_status = 'failed' THEN 'pending' ELSE processing_status END,
    next_retry_at = now(),
    error = NULL
  WHERE id = signal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_platform_feed_items(p_limit integer DEFAULT 25)
RETURNS SETOF public.platform_feed_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT p.id
    FROM public.platform_feed_items p
    WHERE p.processing_status = 'pending'
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

REVOKE ALL ON FUNCTION public.enqueue_platform_feed_processing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_platform_feed_processing(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.claim_platform_feed_items(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_platform_feed_items(integer) TO service_role;
