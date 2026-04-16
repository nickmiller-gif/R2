-- Oracle White Space Run Pipeline
-- Extends the existing oracle_whitespace_core_runs with a full 6-stage
-- pipeline: evidence gathering, entity resolution, hypothesis generation,
-- scoring/verification, publication, and outcome tracking.
--
-- Depends on: oracle_whitespace_core_runs, oracle_theses, asset_registry,
--   oracle_publication_state, charter_user_roles

-- ─── Run status enum ─────────────────────────────────────────────────
CREATE TYPE oracle_run_status AS ENUM (
  'queued',
  'gathering_evidence',
  'resolving_entities',
  'generating_hypotheses',
  'scoring',
  'verification',
  'review',
  'published',
  'failed',
  'cancelled'
);

CREATE TYPE oracle_risk_level AS ENUM ('low', 'medium', 'high');

CREATE TYPE oracle_authority_tier AS ENUM (
  'registry_direct',   -- 95: EPO, USPTO, FDA, ClinicalTrials
  'curated_database',  -- 85: internal curated datasets
  'domain_export',     -- 70: trend exporters, property intel
  'web_search',        -- 50: Perplexity, web results
  'llm_generation'     -- 30: AI-generated, unverified
);

-- ─── White Space Runs (extends core runs concept) ────────────────────
CREATE TABLE oracle_whitespace_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Run definition
  domain text NOT NULL,
  target_entities uuid[] NOT NULL DEFAULT '{}',
  constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_sources_allowed text[] NOT NULL DEFAULT '{}',
  time_horizon text,
  risk_level oracle_risk_level NOT NULL DEFAULT 'medium',
  run_label text,

  -- Execution state
  status oracle_run_status NOT NULL DEFAULT 'queued',
  stage_progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,

  -- Linkage to existing core run (optional backcompat)
  core_run_id uuid REFERENCES oracle_whitespace_core_runs(id) ON DELETE SET NULL,

  -- Ownership and audit
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  started_at timestamptz,
  completed_at timestamptz,

  -- Evaluation summary (populated after scoring)
  evaluation jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Expected shape: { citation_coverage, novelty_score, avg_confidence,
  --   avg_evidence_strength, hypothesis_count, published_count }

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_owsr_status ON oracle_whitespace_runs (status);
CREATE INDEX idx_owsr_created_by ON oracle_whitespace_runs (created_by);
CREATE INDEX idx_owsr_created_at ON oracle_whitespace_runs (created_at DESC);
CREATE INDEX idx_owsr_domain ON oracle_whitespace_runs (domain);

ALTER TABLE oracle_whitespace_runs ENABLE ROW LEVEL SECURITY;

-- Authenticated: see own runs + published runs
-- Operator/counsel/admin: see all runs
CREATE POLICY select_owsr ON oracle_whitespace_runs
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR status = 'published'::oracle_run_status
    OR EXISTS (
      SELECT 1 FROM public.charter_user_roles cur
      WHERE cur.user_id = auth.uid()
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

CREATE POLICY insert_owsr ON oracle_whitespace_runs
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY update_owsr ON oracle_whitespace_runs
  FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);


-- ─── Run Evidence (per-run evidence log) ─────────────────────────────
CREATE TABLE oracle_run_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES oracle_whitespace_runs(id) ON DELETE CASCADE,

  -- Source reference
  chunk_id uuid REFERENCES knowledge_chunks(id) ON DELETE SET NULL,
  source_type oracle_authority_tier NOT NULL,
  source_ref text NOT NULL,  -- URI or identifier for the source
  source_system text,        -- e.g. 'epo', 'fda', 'knowledge_chunks'

  -- Scoring
  authority_score smallint NOT NULL DEFAULT 50
    CHECK (authority_score >= 0 AND authority_score <= 100),
  relevance_score numeric(4,3) CHECK (relevance_score >= 0 AND relevance_score <= 1),

  -- Provenance
  provenance_chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  rights_constraints text[] NOT NULL DEFAULT '{}',
  content_excerpt text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ore_run_id ON oracle_run_evidence (run_id);
CREATE INDEX idx_ore_source_type ON oracle_run_evidence (source_type);
CREATE INDEX idx_ore_chunk_id ON oracle_run_evidence (chunk_id) WHERE chunk_id IS NOT NULL;

ALTER TABLE oracle_run_evidence ENABLE ROW LEVEL SECURITY;

-- Evidence inherits visibility from its parent run
CREATE POLICY select_ore ON oracle_run_evidence
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM oracle_whitespace_runs owr
      WHERE owr.id = oracle_run_evidence.run_id
        AND (
          owr.created_by = auth.uid()
          OR owr.status = 'published'::oracle_run_status
          OR EXISTS (
            SELECT 1 FROM public.charter_user_roles cur
            WHERE cur.user_id = auth.uid()
              AND cur.role::text IN ('operator', 'counsel', 'admin')
          )
        )
    )
  );

CREATE POLICY insert_ore ON oracle_run_evidence
  FOR INSERT TO service_role
  WITH CHECK (true);


-- ─── Run Hypotheses (generated per run, link to theses) ──────────────
CREATE TABLE oracle_run_hypotheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES oracle_whitespace_runs(id) ON DELETE CASCADE,

  -- Links to the Oracle thesis if promoted
  thesis_id uuid REFERENCES oracle_theses(id) ON DELETE SET NULL,

  -- Hypothesis content
  hypothesis_text text NOT NULL,
  reasoning_trace text,   -- ReAct-style step-by-step logic

  -- Scoring dimensions
  novelty_score numeric(4,3) CHECK (novelty_score >= 0 AND novelty_score <= 1),
  evidence_strength numeric(4,3) CHECK (evidence_strength >= 0 AND evidence_strength <= 1),
  confidence numeric(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  actionability numeric(4,3) CHECK (actionability >= 0 AND actionability <= 1),
  composite_score numeric(4,3) CHECK (composite_score >= 0 AND composite_score <= 1),
  -- composite = 0.30*novelty + 0.30*evidence + 0.25*confidence + 0.15*actionability

  -- Evidence citations (IDs from oracle_run_evidence)
  citation_ids uuid[] NOT NULL DEFAULT '{}',

  -- Publication eligibility
  publishable boolean NOT NULL DEFAULT false,
  verification_passed boolean,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orh_run_id ON oracle_run_hypotheses (run_id);
CREATE INDEX idx_orh_thesis_id ON oracle_run_hypotheses (thesis_id) WHERE thesis_id IS NOT NULL;
CREATE INDEX idx_orh_composite_score ON oracle_run_hypotheses (composite_score DESC NULLS LAST);
CREATE INDEX idx_orh_publishable ON oracle_run_hypotheses (publishable) WHERE publishable = true;

ALTER TABLE oracle_run_hypotheses ENABLE ROW LEVEL SECURITY;

-- Hypotheses inherit visibility from their parent run
CREATE POLICY select_orh ON oracle_run_hypotheses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM oracle_whitespace_runs owr
      WHERE owr.id = oracle_run_hypotheses.run_id
        AND (
          owr.created_by = auth.uid()
          OR owr.status = 'published'::oracle_run_status
          OR EXISTS (
            SELECT 1 FROM public.charter_user_roles cur
            WHERE cur.user_id = auth.uid()
              AND cur.role::text IN ('operator', 'counsel', 'admin')
          )
        )
    )
  );

CREATE POLICY insert_orh ON oracle_run_hypotheses
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY update_orh ON oracle_run_hypotheses
  FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);


-- ─── Updated timestamp trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_owsr
  BEFORE UPDATE ON oracle_whitespace_runs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE oracle_whitespace_runs IS
  'Top-level tracking for Oracle White Space investigation runs.';
COMMENT ON TABLE oracle_run_evidence IS
  'Evidence items gathered during a white space run with provenance and authority scoring.';
COMMENT ON TABLE oracle_run_hypotheses IS
  'Generated hypotheses per run, scored on novelty/evidence/confidence/actionability.';
