-- Oracle thesis confidence reweighting (slice O1).
--
-- Records every change to oracle_theses.confidence that comes from a
-- recalibration event -- either new evidence linked to a thesis or a recorded
-- outcome. The service layer ('src/services/oracle/oracle-thesis-confidence
-- .service.ts') is the sole writer; this table is the audit trail.
--
-- Idempotency: a (thesis_id, evidence_link_id) or (thesis_id, outcome_id)
-- pair can only appear once -- the service treats a repeat call as a no-op
-- so re-runs of the outbox or pipeline don't double-count.
--
-- Additive migration. Existing thesis rows are unaffected at apply time.

CREATE TABLE IF NOT EXISTS public.oracle_thesis_confidence_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id uuid NOT NULL REFERENCES public.oracle_theses(id) ON DELETE CASCADE,
  prior_confidence numeric NOT NULL,
  new_confidence numeric NOT NULL,
  delta numeric NOT NULL,
  evidence_link_id uuid REFERENCES public.oracle_thesis_evidence_links(id) ON DELETE SET NULL,
  outcome_id uuid REFERENCES public.oracle_outcomes(id) ON DELETE SET NULL,
  recalibration_method text NOT NULL DEFAULT 'bayesian-v1',
  log_odds_shift numeric NOT NULL DEFAULT 0,
  reason text,
  actor uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oracle_thesis_confidence_history_source_present
    CHECK (evidence_link_id IS NOT NULL OR outcome_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_oracle_thesis_confidence_history_thesis
  ON public.oracle_thesis_confidence_history (thesis_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oracle_thesis_confidence_history_method
  ON public.oracle_thesis_confidence_history (recalibration_method, created_at DESC);

-- Partial unique indexes give us per-source idempotency without blocking
-- multiple NULL slots on either side. PostgreSQL treats NULLs as distinct in
-- regular unique indexes; a WHERE clause keeps the constraint scoped.
CREATE UNIQUE INDEX IF NOT EXISTS uq_oracle_thesis_confidence_history_evidence
  ON public.oracle_thesis_confidence_history (thesis_id, evidence_link_id)
  WHERE evidence_link_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_oracle_thesis_confidence_history_outcome
  ON public.oracle_thesis_confidence_history (thesis_id, outcome_id)
  WHERE outcome_id IS NOT NULL;

COMMENT ON TABLE public.oracle_thesis_confidence_history IS
  'Audit trail of every recalibration of oracle_theses.confidence. Written by the oracle-thesis-confidence service; never by hand.';
COMMENT ON COLUMN public.oracle_thesis_confidence_history.recalibration_method IS
  'Formula version tag. Lets us A/B alternate weighting schemes without rewriting historic rows.';
COMMENT ON COLUMN public.oracle_thesis_confidence_history.log_odds_shift IS
  'Bayesian-v1: signed shift applied to logit(confidence/100). Stored for debuggability.';

ALTER TABLE public.oracle_thesis_confidence_history ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user with an operator/counsel/admin/member role on
-- Charter. Mirrors oracle_publication_events' visibility model.
CREATE POLICY select_oracle_thesis_confidence_history
  ON public.oracle_thesis_confidence_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = auth.uid()
        AND cur.role::text IN ('operator', 'counsel', 'admin', 'member')
    )
  );

-- Write: service role only. Recalibration is a server-side responsibility;
-- nothing in the operator UI should create rows directly.
CREATE POLICY insert_oracle_thesis_confidence_history
  ON public.oracle_thesis_confidence_history
  FOR INSERT TO service_role
  WITH CHECK (true);
