-- Confidence-bound autonomy controls for signal processing.
-- Adds explicit policy thresholds and per-signal decisions so Stage 3->6
-- transitions are observable and bounded.

CREATE TABLE IF NOT EXISTS public.signal_confidence_policies (
  action_class text PRIMARY KEY CHECK (
    action_class IN ('observe', 'propose', 'act', 'irreversible')
  ),
  min_confidence numeric(4, 3) NOT NULL CHECK (
    min_confidence >= 0
    AND min_confidence <= 1
  ),
  allow_autonomous boolean NOT NULL DEFAULT true,
  require_operator_review boolean NOT NULL DEFAULT false,
  rationale text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.signal_confidence_policies (
  action_class,
  min_confidence,
  allow_autonomous,
  require_operator_review,
  rationale
)
VALUES
  ('observe', 0.400, true, false, 'Autonomous ingest/enrichment floor.'),
  ('propose', 0.650, true, false, 'Autonomous proposal creation floor.'),
  ('act', 0.850, true, false, 'Autonomous reversible action floor.'),
  (
    'irreversible',
    0.950,
    false,
    true,
    'Public/publish-adjacent actions require operator review.'
  )
ON CONFLICT (action_class) DO NOTHING;

ALTER TABLE public.signal_confidence_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_signal_confidence_policies
  ON public.signal_confidence_policies;
CREATE POLICY select_signal_confidence_policies
  ON public.signal_confidence_policies
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

DROP POLICY IF EXISTS update_signal_confidence_policies
  ON public.signal_confidence_policies;
CREATE POLICY update_signal_confidence_policies
  ON public.signal_confidence_policies
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.platform_feed_items
  ADD COLUMN IF NOT EXISTS autonomy_action_class text,
  ADD COLUMN IF NOT EXISTS autonomy_decision text,
  ADD COLUMN IF NOT EXISTS autonomy_threshold numeric(4, 3),
  ADD COLUMN IF NOT EXISTS autonomy_reason text,
  ADD COLUMN IF NOT EXISTS autonomy_decided_at timestamptz;

ALTER TABLE public.platform_feed_items
  DROP CONSTRAINT IF EXISTS platform_feed_items_autonomy_action_class_check;
ALTER TABLE public.platform_feed_items
  ADD CONSTRAINT platform_feed_items_autonomy_action_class_check
  CHECK (
    autonomy_action_class IS NULL
    OR autonomy_action_class IN ('observe', 'propose', 'act', 'irreversible')
  );

ALTER TABLE public.platform_feed_items
  DROP CONSTRAINT IF EXISTS platform_feed_items_autonomy_decision_check;
ALTER TABLE public.platform_feed_items
  ADD CONSTRAINT platform_feed_items_autonomy_decision_check
  CHECK (
    autonomy_decision IS NULL
    OR autonomy_decision IN ('auto_publish', 'needs_review', 'blocked')
  );

ALTER TABLE public.platform_feed_items
  DROP CONSTRAINT IF EXISTS platform_feed_items_autonomy_threshold_bounds;
ALTER TABLE public.platform_feed_items
  ADD CONSTRAINT platform_feed_items_autonomy_threshold_bounds
  CHECK (
    autonomy_threshold IS NULL
    OR (autonomy_threshold >= 0 AND autonomy_threshold <= 1)
  );

ALTER TABLE public.platform_feed_items
  DROP CONSTRAINT IF EXISTS platform_feed_items_autonomy_reason_bounds;
ALTER TABLE public.platform_feed_items
  ADD CONSTRAINT platform_feed_items_autonomy_reason_bounds
  CHECK (autonomy_reason IS NULL OR length(autonomy_reason) <= 500);

CREATE INDEX IF NOT EXISTS platform_feed_items_autonomy_decision_idx
  ON public.platform_feed_items (autonomy_decision, ingested_at DESC)
  WHERE autonomy_decision IS NOT NULL;

CREATE INDEX IF NOT EXISTS platform_feed_items_autonomy_action_class_idx
  ON public.platform_feed_items (autonomy_action_class, ingested_at DESC)
  WHERE autonomy_action_class IS NOT NULL;;
