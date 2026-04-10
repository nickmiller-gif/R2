-- Oracle publication governance boundary + read model projections.
-- Introduces explicit publication workflow for signals, publication decision audit,
-- operator-aware RLS boundaries, and stable briefing/theme/feed read models.

ALTER TABLE public.oracle_signals
  ADD COLUMN publication_state oracle_publication_state NOT NULL DEFAULT 'pending_review',
  ADD COLUMN published_at timestamptz,
  ADD COLUMN published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN publication_notes text;

CREATE INDEX idx_oracle_signals_publication_state
  ON public.oracle_signals (publication_state);

CREATE INDEX idx_oracle_signals_published_at
  ON public.oracle_signals (published_at DESC)
  WHERE published_at IS NOT NULL;

COMMENT ON COLUMN public.oracle_signals.publication_state IS
  'Publication workflow state for operator-facing and published signal visibility.';
COMMENT ON COLUMN public.oracle_signals.published_at IS
  'UTC timestamp when the signal was published.';
COMMENT ON COLUMN public.oracle_signals.published_by IS
  'User id that published the signal.';

CREATE TABLE public.oracle_publication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('thesis', 'signal')),
  target_id uuid NOT NULL,
  from_state oracle_publication_state,
  to_state oracle_publication_state NOT NULL,
  decided_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  decided_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oracle_publication_events_target
  ON public.oracle_publication_events (target_type, target_id, decided_at DESC);

ALTER TABLE public.oracle_publication_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_publication_events ON public.oracle_publication_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = auth.uid()
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

CREATE POLICY insert_oracle_publication_events ON public.oracle_publication_events
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS oracle_signals_read ON public.oracle_signals;
CREATE POLICY oracle_signals_read ON public.oracle_signals
  FOR SELECT TO authenticated
  USING (
    publication_state = 'published'::oracle_publication_state
    OR EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = auth.uid()
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS select_oracle_theses ON public.oracle_theses;
CREATE POLICY select_oracle_theses ON public.oracle_theses
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR publication_state = 'published'::oracle_publication_state
    OR EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = auth.uid()
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS select_oracle_thesis_evidence_links ON public.oracle_thesis_evidence_links;
CREATE POLICY select_oracle_thesis_evidence_links ON public.oracle_thesis_evidence_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.oracle_theses ot
      WHERE ot.id = oracle_thesis_evidence_links.thesis_id
        AND (
          ot.profile_id = auth.uid()
          OR ot.publication_state = 'published'::oracle_publication_state
          OR EXISTS (
            SELECT 1
            FROM public.charter_user_roles cur
            WHERE cur.user_id = auth.uid()
              AND cur.role::text IN ('operator', 'counsel', 'admin')
          )
        )
    )
  );

CREATE OR REPLACE VIEW public.oracle_briefings_read_model AS
SELECT
  ot.id AS thesis_id,
  ot.title,
  ot.thesis_statement,
  ot.confidence,
  ot.evidence_strength,
  ot.published_at,
  ot.published_by,
  COALESCE(
    ARRAY(
      SELECT jsonb_array_elements_text(COALESCE(ot.metadata -> 'topicTags', '[]'::jsonb))
    ),
    ARRAY[]::text[]
  ) AS topic_tags
FROM public.oracle_theses ot
WHERE ot.publication_state = 'published'::oracle_publication_state
  AND ot.published_at IS NOT NULL;

CREATE OR REPLACE VIEW public.oracle_theme_map_read_model AS
WITH themed_theses AS (
  SELECT
    lower(theme_entries.theme) AS theme,
    ot.confidence,
    ot.published_at
  FROM public.oracle_theses ot
  CROSS JOIN LATERAL (
    SELECT jsonb_array_elements_text(
      COALESCE(ot.metadata -> 'themes', ot.metadata -> 'topicTags', '[]'::jsonb)
    ) AS theme
  ) AS theme_entries
  WHERE ot.publication_state = 'published'::oracle_publication_state
    AND ot.published_at IS NOT NULL
)
SELECT
  theme,
  count(*)::int AS thesis_count,
  avg(confidence)::numeric(6,2) AS avg_confidence,
  max(published_at) AS latest_published_at
FROM themed_theses
GROUP BY theme;

CREATE OR REPLACE VIEW public.oracle_feed_history_read_model AS
SELECT
  'thesis'::text AS item_type,
  ot.id AS item_id,
  ot.published_at,
  ot.title,
  ot.uncertainty_summary AS summary,
  jsonb_build_object(
    'confidence', ot.confidence,
    'evidence_strength', ot.evidence_strength
  ) AS metadata
FROM public.oracle_theses ot
WHERE ot.publication_state = 'published'::oracle_publication_state
  AND ot.published_at IS NOT NULL

UNION ALL

SELECT
  'signal'::text AS item_type,
  os.id AS item_id,
  os.published_at,
  concat('Signal for entity ', os.entity_asset_id::text) AS title,
  os.publication_notes AS summary,
  jsonb_build_object(
    'score', os.score,
    'confidence', os.confidence,
    'producer_ref', os.producer_ref
  ) AS metadata
FROM public.oracle_signals os
WHERE os.publication_state = 'published'::oracle_publication_state
  AND os.published_at IS NOT NULL

UNION ALL

SELECT
  'outcome'::text AS item_type,
  oo.id AS item_id,
  ot.published_at,
  concat('Outcome for thesis ', oo.thesis_id::text) AS title,
  oo.summary,
  jsonb_build_object(
    'verdict', oo.verdict,
    'outcome_source', oo.outcome_source,
    'accuracy_score', oo.accuracy_score
  ) AS metadata
FROM public.oracle_outcomes oo
JOIN public.oracle_theses ot ON ot.id = oo.thesis_id
WHERE ot.publication_state = 'published'::oracle_publication_state
  AND ot.published_at IS NOT NULL;

