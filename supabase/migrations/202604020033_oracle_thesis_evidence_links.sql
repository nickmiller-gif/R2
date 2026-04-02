-- Oracle thesis-evidence links table
-- Relationships between theses and evidence items, tracking role and weight

CREATE TYPE oracle_thesis_evidence_role AS ENUM (
  'inspiration',
  'validation',
  'contradiction'
);

CREATE TABLE oracle_thesis_evidence_links (
  thesis_id uuid NOT NULL REFERENCES oracle_theses(id) ON DELETE CASCADE,
  evidence_item_id uuid NOT NULL REFERENCES oracle_evidence_items(id) ON DELETE CASCADE,
  role oracle_thesis_evidence_role NOT NULL,
  weight numeric NOT NULL DEFAULT 1.0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  PRIMARY KEY (thesis_id, evidence_item_id, role),
  UNIQUE(thesis_id, evidence_item_id, role)
);

-- Indexes for common queries
CREATE INDEX idx_oracle_thesis_evidence_links_thesis_id ON oracle_thesis_evidence_links(thesis_id);
CREATE INDEX idx_oracle_thesis_evidence_links_evidence_item_id ON oracle_thesis_evidence_links(evidence_item_id);
CREATE INDEX idx_oracle_thesis_evidence_links_role ON oracle_thesis_evidence_links(role);

-- Row-Level Security
ALTER TABLE oracle_thesis_evidence_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_thesis_evidence_links ON oracle_thesis_evidence_links
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM oracle_theses ot
      WHERE ot.id = thesis_id
      AND (ot.profile_id = auth.uid() OR ot.publication_state = 'published')
    )
  );

CREATE POLICY insert_oracle_thesis_evidence_links ON oracle_thesis_evidence_links
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM oracle_theses ot
      WHERE ot.id = thesis_id
      AND ot.profile_id = auth.uid()
    )
  );

CREATE POLICY delete_oracle_thesis_evidence_links ON oracle_thesis_evidence_links
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM oracle_theses ot
      WHERE ot.id = thesis_id
      AND ot.profile_id = auth.uid()
    )
  );
