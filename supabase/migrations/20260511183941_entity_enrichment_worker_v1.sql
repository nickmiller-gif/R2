-- Entity enrichment bots — evidence, consensus snapshots, review queue, batch checkpoints.
-- Apply to Eigen / R2 Supabase (or project hosting meg_entities). Idempotent where possible.

ALTER TABLE public.meg_entities
  ADD COLUMN IF NOT EXISTS enrichment_consensus jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.meg_entities.enrichment_consensus IS
  'Merged field-level enrichment outputs from entity-enrichment-worker (v1).';

CREATE TABLE IF NOT EXISTS public.entity_enrichment_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('client', 'property', 'person')),
  meg_entity_id uuid NOT NULL REFERENCES public.meg_entities (id) ON DELETE CASCADE,
  field_path text NOT NULL,
  value_json jsonb NOT NULL,
  source_key text NOT NULL,
  source_tier double precision NOT NULL CHECK (source_tier >= 0 AND source_tier <= 1),
  observed_at timestamptz NOT NULL,
  raw_snippet text,
  ingest_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_enrichment_evidence_entity_field
  ON public.entity_enrichment_evidence (meg_entity_id, field_path);

CREATE INDEX IF NOT EXISTS idx_entity_enrichment_evidence_site_entity
  ON public.entity_enrichment_evidence (site_id, meg_entity_id);

CREATE TABLE IF NOT EXISTS public.entity_enrichment_field_consensus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('client', 'property', 'person')),
  meg_entity_id uuid NOT NULL REFERENCES public.meg_entities (id) ON DELETE CASCADE,
  field_path text NOT NULL,
  consensus_score double precision NOT NULL,
  consensus_value_json jsonb,
  consensus_reason_json jsonb NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, meg_entity_id, field_path)
);

CREATE TABLE IF NOT EXISTS public.entity_enrichment_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('client', 'property', 'person')),
  meg_entity_id uuid NOT NULL REFERENCES public.meg_entities (id) ON DELETE CASCADE,
  field_path text NOT NULL,
  status text NOT NULL CHECK (
    status IN ('pending_review', 'approved', 'rejected', 'needs_more_evidence')
  ),
  payload_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

CREATE INDEX IF NOT EXISTS idx_entity_enrichment_review_pending
  ON public.entity_enrichment_review_queue (site_id, status)
  WHERE status = 'pending_review';

CREATE TABLE IF NOT EXISTS public.entity_enrichment_run_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL,
  run_kind text NOT NULL,
  last_meg_entity_id uuid,
  fields_refreshed integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, run_kind)
);

COMMENT ON TABLE public.entity_enrichment_evidence IS
  'Append-only observations feeding hybrid consensus per field_path.';
COMMENT ON TABLE public.entity_enrichment_field_consensus IS
  'Latest consensus snapshot per (site, meg_entity, field_path).';
COMMENT ON TABLE public.entity_enrichment_review_queue IS
  'Low-confidence or conflicted fields for operator promotion.';;
