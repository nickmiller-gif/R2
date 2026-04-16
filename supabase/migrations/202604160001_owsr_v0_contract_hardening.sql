-- OWSR v0 contract hardening
-- Adds producer metadata fields and keeps scorecard/graph job tables present
-- for environments where older migrations were applied selectively.

ALTER TABLE IF EXISTS public.oracle_run_evidence
  ADD COLUMN IF NOT EXISTS ingest_run jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_tier text,
  ADD COLUMN IF NOT EXISTS sources_queried text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS adversarial_pass boolean,
  ADD COLUMN IF NOT EXISTS registry_verified_ratio numeric(5,4);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'oracle_run_evidence'
      AND column_name = 'evidence_tier'
  ) THEN
    ALTER TABLE public.oracle_run_evidence
      DROP CONSTRAINT IF EXISTS oracle_run_evidence_evidence_tier_check;

    ALTER TABLE public.oracle_run_evidence
      ADD CONSTRAINT oracle_run_evidence_evidence_tier_check
      CHECK (
        evidence_tier IS NULL
        OR evidence_tier IN (
          'registry_direct',
          'curated_database',
          'domain_export',
          'web_search',
          'llm_generation'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_oracle_run_evidence_ingest_run_id
  ON public.oracle_run_evidence ((ingest_run ->> 'id'));
CREATE INDEX IF NOT EXISTS idx_oracle_run_evidence_evidence_tier
  ON public.oracle_run_evidence (evidence_tier);
CREATE INDEX IF NOT EXISTS idx_oracle_run_evidence_sources_queried
  ON public.oracle_run_evidence USING gin (sources_queried);

CREATE TABLE IF NOT EXISTS public.oracle_run_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES public.oracle_whitespace_runs(id) ON DELETE CASCADE,
  model_version text NOT NULL,
  hypothesis_count integer NOT NULL DEFAULT 0,
  published_count integer NOT NULL DEFAULT 0,
  citation_coverage numeric NOT NULL DEFAULT 0,
  novelty_score numeric NOT NULL DEFAULT 0,
  avg_confidence numeric NOT NULL DEFAULT 0,
  avg_evidence_strength numeric NOT NULL DEFAULT 0,
  verified_rate numeric NOT NULL DEFAULT 0,
  evidence_diversity integer NOT NULL DEFAULT 0,
  avg_composite_score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oracle_run_scorecards_run_id
  ON public.oracle_run_scorecards(run_id);

CREATE TABLE IF NOT EXISTS public.oracle_graph_extraction_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES public.oracle_whitespace_runs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority integer NOT NULL DEFAULT 50,
  trigger text NOT NULL DEFAULT 'pipeline_execute',
  domain text,
  target_entities text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_oracle_graph_jobs_status_priority
  ON public.oracle_graph_extraction_jobs(status, priority DESC, created_at ASC);

ALTER TABLE IF EXISTS public.oracle_run_scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.oracle_graph_extraction_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'oracle_run_scorecards'
      AND policyname = 'select_oracle_run_scorecards'
  ) THEN
    CREATE POLICY select_oracle_run_scorecards
      ON public.oracle_run_scorecards
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'oracle_run_scorecards'
      AND policyname = 'insert_oracle_run_scorecards'
  ) THEN
    CREATE POLICY insert_oracle_run_scorecards
      ON public.oracle_run_scorecards
      FOR INSERT TO service_role
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'oracle_run_scorecards'
      AND policyname = 'update_oracle_run_scorecards'
  ) THEN
    CREATE POLICY update_oracle_run_scorecards
      ON public.oracle_run_scorecards
      FOR UPDATE TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'oracle_graph_extraction_jobs'
      AND policyname = 'select_oracle_graph_extraction_jobs'
  ) THEN
    CREATE POLICY select_oracle_graph_extraction_jobs
      ON public.oracle_graph_extraction_jobs
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'oracle_graph_extraction_jobs'
      AND policyname = 'insert_oracle_graph_extraction_jobs'
  ) THEN
    CREATE POLICY insert_oracle_graph_extraction_jobs
      ON public.oracle_graph_extraction_jobs
      FOR INSERT TO service_role
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'oracle_graph_extraction_jobs'
      AND policyname = 'update_oracle_graph_extraction_jobs'
  ) THEN
    CREATE POLICY update_oracle_graph_extraction_jobs
      ON public.oracle_graph_extraction_jobs
      FOR UPDATE TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
