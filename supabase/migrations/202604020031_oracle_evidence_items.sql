-- Oracle evidence items table
-- Discrete evidence pieces that support or contradict theses

CREATE TABLE oracle_evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_id uuid REFERENCES oracle_signals(id) ON DELETE SET NULL,

  -- Source classification
  source_lane text NOT NULL,
  source_class text NOT NULL,
  source_ref text NOT NULL,

  -- Content and assessment
  content_summary text NOT NULL,
  confidence numeric NOT NULL DEFAULT 50,
  evidence_strength numeric NOT NULL DEFAULT 0,

  -- Source metadata
  source_date timestamp with time zone,
  publication_url text,
  author_info jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Extensible metadata
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_oracle_evidence_items_signal_id ON oracle_evidence_items(signal_id);
CREATE INDEX idx_oracle_evidence_items_source_lane ON oracle_evidence_items(source_lane);
CREATE INDEX idx_oracle_evidence_items_profile_id ON oracle_evidence_items(profile_id);
CREATE INDEX idx_oracle_evidence_items_created_at ON oracle_evidence_items(created_at DESC);

-- Row-Level Security
ALTER TABLE oracle_evidence_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_evidence_items ON oracle_evidence_items
  FOR SELECT
  USING (auth.role() = 'authenticated' AND profile_id = auth.uid());

CREATE POLICY insert_oracle_evidence_items ON oracle_evidence_items
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR profile_id = auth.uid());

CREATE POLICY update_oracle_evidence_items ON oracle_evidence_items
  FOR UPDATE
  USING (auth.role() = 'service_role' OR profile_id = auth.uid())
  WITH CHECK (auth.role() = 'service_role' OR profile_id = auth.uid());

CREATE POLICY delete_oracle_evidence_items ON oracle_evidence_items
  FOR DELETE
  USING (auth.role() = 'service_role' OR profile_id = auth.uid());
