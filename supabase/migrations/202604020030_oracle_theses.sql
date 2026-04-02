-- Oracle theses table and supporting types
-- Theses are structured claims about market/domain conditions

CREATE TYPE oracle_thesis_status AS ENUM (
  'draft',
  'active',
  'challenged',
  'superseded',
  'retired'
);

CREATE TYPE oracle_novelty_status AS ENUM (
  'new',
  'known',
  'duplicate',
  'near_duplicate',
  'updated_existing'
);

CREATE TYPE oracle_publication_state AS ENUM (
  'pending_review',
  'approved',
  'rejected',
  'deferred',
  'published'
);

CREATE TABLE oracle_theses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  thesis_statement text NOT NULL,
  status oracle_thesis_status NOT NULL DEFAULT 'draft',
  novelty_status oracle_novelty_status NOT NULL DEFAULT 'new',
  duplicate_of_thesis_id uuid REFERENCES oracle_theses(id) ON DELETE SET NULL,
  superseded_by_thesis_id uuid REFERENCES oracle_theses(id) ON DELETE SET NULL,

  -- Arrays of related entity IDs (stored as JSON for flexibility)
  inspiration_signal_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  inspiration_evidence_item_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_evidence_item_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  contradiction_evidence_item_ids jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Scoring and evidence tracking
  confidence numeric NOT NULL DEFAULT 50,
  evidence_strength numeric NOT NULL DEFAULT 0,
  uncertainty_summary text,

  -- Publication workflow
  publication_state oracle_publication_state NOT NULL DEFAULT 'pending_review',
  published_at timestamp with time zone,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Decision audit trail
  last_decision_at timestamp with time zone,
  last_decision_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decision_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Extensible metadata
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  platform_id text,
  site_domain text,
  visibility_class text,
  access_policy jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_oracle_theses_status ON oracle_theses(status);
CREATE INDEX idx_oracle_theses_profile_id ON oracle_theses(profile_id);
CREATE INDEX idx_oracle_theses_publication_state ON oracle_theses(publication_state);
CREATE INDEX idx_oracle_theses_novelty_status ON oracle_theses(novelty_status);
CREATE INDEX idx_oracle_theses_created_at ON oracle_theses(created_at DESC);

-- Row-Level Security
ALTER TABLE oracle_theses ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_theses ON oracle_theses
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      profile_id = auth.uid()
      OR publication_state = 'published'
    )
  );

CREATE POLICY insert_oracle_theses ON oracle_theses
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR profile_id = auth.uid());

CREATE POLICY update_oracle_theses ON oracle_theses
  FOR UPDATE
  USING (auth.role() = 'service_role' OR profile_id = auth.uid())
  WITH CHECK (auth.role() = 'service_role' OR profile_id = auth.uid());

CREATE POLICY delete_oracle_theses ON oracle_theses
  FOR DELETE
  USING (auth.role() = 'service_role' OR profile_id = auth.uid());
