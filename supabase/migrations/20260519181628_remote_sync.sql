DO $$ BEGIN
  CREATE TYPE public.oracle_opportunity_lifecycle AS ENUM (
    'draft','scoped','proof','live','won','lost','archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.oracle_opportunities
  ADD COLUMN IF NOT EXISTS lifecycle_state public.oracle_opportunity_lifecycle NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS economics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS proof_required jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS outcomes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS confidence_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS source_system text,
  ADD COLUMN IF NOT EXISTS platform_feed_item_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS oracle_evidence_item_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS asset_registry_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS oracle_opportunities_lifecycle_idx
  ON public.oracle_opportunities (lifecycle_state);
;
