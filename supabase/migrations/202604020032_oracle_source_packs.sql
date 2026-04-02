-- Oracle source packs table
-- Collections of sources organized by lane for efficient governance

CREATE TYPE oracle_source_lane AS ENUM (
  'internal_canonical',
  'external_authoritative',
  'external_perspective',
  'federated_openai_vector',
  'narrative_context_scenario'
);

CREATE TABLE oracle_source_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_lane oracle_source_lane NOT NULL,

  -- Array of source IDs (stored as JSON for flexibility)
  source_ids jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Extensible metadata
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_oracle_source_packs_profile_id ON oracle_source_packs(profile_id);
CREATE INDEX idx_oracle_source_packs_source_lane ON oracle_source_packs(source_lane);
CREATE INDEX idx_oracle_source_packs_created_at ON oracle_source_packs(created_at DESC);

-- Row-Level Security
ALTER TABLE oracle_source_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_source_packs ON oracle_source_packs
  FOR SELECT
  USING (auth.role() = 'authenticated' AND profile_id = auth.uid());

CREATE POLICY insert_oracle_source_packs ON oracle_source_packs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR profile_id = auth.uid());

CREATE POLICY update_oracle_source_packs ON oracle_source_packs
  FOR UPDATE
  USING (auth.role() = 'service_role' OR profile_id = auth.uid())
  WITH CHECK (auth.role() = 'service_role' OR profile_id = auth.uid());

CREATE POLICY delete_oracle_source_packs ON oracle_source_packs
  FOR DELETE
  USING (auth.role() = 'service_role' OR profile_id = auth.uid());
