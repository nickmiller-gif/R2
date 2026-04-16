-- Verification Framework + Calibration Loop
-- Generalizes ip-insights-hub's anti-hallucination pattern into a shared
-- verification audit table, and adds calibration logging for the Oracle
-- truth maintenance loop (predict → observe → measure → improve).
--
-- Depends on: oracle_whitespace_runs, oracle_run_hypotheses, oracle_theses,
--   oracle_outcomes, oracle_authority_tier

-- ─── Verification verdict enum ───────────────────────────────────────
CREATE TYPE verification_verdict AS ENUM (
  'verified',           -- Passed consensus + adversarial checks
  'partially_verified', -- Some sources agree, some conflict
  'unverified',         -- Insufficient sources to reach consensus
  'refuted',            -- Adversarial check found contradicting evidence
  'skipped'             -- Low-risk, verification not required
);

-- ─── Verification Results ────────────────────────────────────────────
-- Audit log for every verification check run against a claim.
-- Used by the run engine (Stage 5) and available to operators on-demand.

CREATE TABLE IF NOT EXISTS verification_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was verified
  claim_text text NOT NULL,
  hypothesis_id uuid REFERENCES oracle_run_hypotheses(id) ON DELETE SET NULL,
  run_id uuid REFERENCES oracle_whitespace_runs(id) ON DELETE SET NULL,

  -- Verification outcome
  verdict verification_verdict NOT NULL,
  consensus_score numeric(4,3)
    CHECK (consensus_score IS NULL OR (consensus_score >= 0 AND consensus_score <= 1)),
  consensus_threshold numeric(4,3) NOT NULL DEFAULT 0.667,

  -- Source check details
  -- Array of: { source_type, source_ref, authority_tier, agrees: bool, excerpt, checked_at }
  source_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources_checked int NOT NULL DEFAULT 0,
  sources_agreeing int NOT NULL DEFAULT 0,

  -- Adversarial check
  adversarial_check_run boolean NOT NULL DEFAULT false,
  adversarial_result jsonb,
  -- Shape: { model, challenge, response, confidence, contradictions[] }

  -- Metadata
  verifier_model text,         -- e.g. 'gemini-2.5-flash'
  verification_duration_ms int,
  verified_at timestamptz NOT NULL DEFAULT now(),

  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE verification_results
  ADD COLUMN IF NOT EXISTS verified_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_vr_hypothesis ON verification_results (hypothesis_id) WHERE hypothesis_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vr_run ON verification_results (run_id) WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vr_verdict ON verification_results (verdict);
CREATE INDEX IF NOT EXISTS idx_vr_verified_at ON verification_results (verified_at DESC);

ALTER TABLE verification_results ENABLE ROW LEVEL SECURITY;

-- Operators can see all verification results; others see only for published runs
CREATE POLICY select_vr ON verification_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.charter_user_roles cur
      WHERE cur.user_id = auth.uid()
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
    OR (
      run_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM oracle_whitespace_runs owr
        WHERE owr.id = verification_results.run_id
          AND owr.status::text = 'published'
      )
    )
  );

CREATE POLICY insert_vr ON verification_results
  FOR INSERT TO service_role
  WITH CHECK (true);


-- ─── Calibration Log ─────────────────────────────────────────────────
-- Records the delta between what the Oracle predicted (thesis confidence)
-- and what actually happened (outcome verdict). This is the learning loop.

CREATE TABLE IF NOT EXISTS oracle_calibration_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was predicted vs. observed
  thesis_id uuid NOT NULL REFERENCES oracle_theses(id) ON DELETE CASCADE,
  outcome_id uuid NOT NULL REFERENCES oracle_outcomes(id) ON DELETE CASCADE,

  -- Prediction snapshot (at time of thesis creation)
  predicted_confidence numeric(4,3) NOT NULL
    CHECK (predicted_confidence >= 0 AND predicted_confidence <= 1),
  predicted_evidence_strength numeric(4,3)
    CHECK (predicted_evidence_strength >= 0 AND predicted_evidence_strength <= 1),

  -- Actual result
  actual_verdict oracle_outcome_verdict NOT NULL,
  accuracy_score numeric(4,3)
    CHECK (accuracy_score IS NULL OR (accuracy_score >= 0 AND accuracy_score <= 1)),

  -- Calibration metrics
  calibration_error numeric(5,4),
  -- |predicted_confidence - accuracy_score| : lower is better
  confidence_delta numeric(5,4),
  -- accuracy_score - predicted_confidence : positive = underconfident, negative = overconfident

  -- Model/prompt version tracking (for A/B analysis)
  model_version text,
  prompt_version text,
  run_id uuid REFERENCES oracle_whitespace_runs(id) ON DELETE SET NULL,

  -- Domain context for segmented calibration analysis
  domain text,
  entity_types text[] NOT NULL DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE oracle_calibration_log
  ADD COLUMN IF NOT EXISTS thesis_id uuid,
  ADD COLUMN IF NOT EXISTS outcome_id uuid,
  ADD COLUMN IF NOT EXISTS predicted_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS predicted_evidence_strength numeric(4,3),
  ADD COLUMN IF NOT EXISTS actual_verdict oracle_outcome_verdict,
  ADD COLUMN IF NOT EXISTS accuracy_score numeric(4,3),
  ADD COLUMN IF NOT EXISTS calibration_error numeric(5,4),
  ADD COLUMN IF NOT EXISTS confidence_delta numeric(5,4),
  ADD COLUMN IF NOT EXISTS model_version text,
  ADD COLUMN IF NOT EXISTS prompt_version text,
  ADD COLUMN IF NOT EXISTS run_id uuid,
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS entity_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ocl_thesis ON oracle_calibration_log (thesis_id);
CREATE INDEX IF NOT EXISTS idx_ocl_outcome ON oracle_calibration_log (outcome_id);
CREATE INDEX IF NOT EXISTS idx_ocl_domain ON oracle_calibration_log (domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ocl_model ON oracle_calibration_log (model_version) WHERE model_version IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ocl_created_at ON oracle_calibration_log (created_at DESC);

-- Unique: one calibration entry per thesis-outcome pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_ocl_thesis_outcome ON oracle_calibration_log (thesis_id, outcome_id);

ALTER TABLE oracle_calibration_log ENABLE ROW LEVEL SECURITY;

-- Operators only
CREATE POLICY select_ocl ON oracle_calibration_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.charter_user_roles cur
      WHERE cur.user_id = auth.uid()
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

CREATE POLICY insert_ocl ON oracle_calibration_log
  FOR INSERT TO service_role
  WITH CHECK (true);


-- ─── Calibration summary view ────────────────────────────────────────
-- Aggregated calibration metrics for model/prompt performance monitoring.
-- Drives the "are we getting better?" dashboard.

CREATE OR REPLACE VIEW oracle_calibration_summary
WITH (security_invoker = true)
AS
SELECT
  model_version,
  prompt_version,
  domain,
  count(*)::int AS sample_count,
  round(avg(calibration_error)::numeric, 4)::double precision AS avg_calibration_error,
  round(avg(confidence_delta)::numeric, 4)::double precision AS avg_confidence_delta,
  round(avg(accuracy_score)::numeric, 4)::double precision AS avg_accuracy,
  round(stddev(calibration_error)::numeric, 4)::double precision AS stddev_calibration_error,
  count(*) FILTER (WHERE confidence_delta > 0)::int AS underconfident_count,
  count(*) FILTER (WHERE confidence_delta < 0)::int AS overconfident_count,
  min(created_at) AS earliest_sample,
  max(created_at) AS latest_sample
FROM oracle_calibration_log
GROUP BY model_version, prompt_version, domain;

GRANT SELECT ON oracle_calibration_summary TO authenticated;


-- ─── Provenance fields on documents table ────────────────────────────
-- Extend existing documents table with rights/provenance metadata
-- for governance-aware retrieval and publication gates.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents'
      AND column_name = 'source_license'
  ) THEN
    ALTER TABLE public.documents
      ADD COLUMN source_license text,
      ADD COLUMN source_authority_tier oracle_authority_tier,
      ADD COLUMN rights_constraints text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

COMMENT ON TABLE verification_results IS
  'Audit log for multi-source verification checks on claims and hypotheses.';
COMMENT ON TABLE oracle_calibration_log IS
  'Truth maintenance loop: prediction vs. outcome delta for calibration analysis.';
COMMENT ON VIEW oracle_calibration_summary IS
  'Aggregated calibration metrics by model/prompt/domain for performance monitoring.';
