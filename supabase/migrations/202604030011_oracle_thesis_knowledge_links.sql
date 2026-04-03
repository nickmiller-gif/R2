-- Oracle → Eigen Bridge — thesis-to-knowledge-chunk links
-- Closes Gap #2: Oracle outputs now feed into Eigen knowledge layer.

CREATE TYPE thesis_knowledge_link_type AS ENUM (
  'generated',
  'validated',
  'contradicted',
  'refined'
);

CREATE TYPE thesis_knowledge_link_status AS ENUM (
  'active',
  'superseded',
  'retracted'
);

CREATE TABLE oracle_thesis_knowledge_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id UUID NOT NULL REFERENCES oracle_theses(id) ON DELETE CASCADE,
  knowledge_chunk_id UUID NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
  link_type thesis_knowledge_link_type NOT NULL,
  status thesis_knowledge_link_status NOT NULL DEFAULT 'active',
  confidence INTEGER NOT NULL DEFAULT 80,
  distillation_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_thesis_chunk_link UNIQUE (thesis_id, knowledge_chunk_id, link_type)
);

CREATE INDEX idx_otkl_thesis_id ON oracle_thesis_knowledge_links(thesis_id);
CREATE INDEX idx_otkl_knowledge_chunk_id ON oracle_thesis_knowledge_links(knowledge_chunk_id);
CREATE INDEX idx_otkl_link_type ON oracle_thesis_knowledge_links(link_type);
CREATE INDEX idx_otkl_status ON oracle_thesis_knowledge_links(status);

ALTER TABLE oracle_thesis_knowledge_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_thesis_knowledge_links ON oracle_thesis_knowledge_links
  FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_oracle_thesis_knowledge_links ON oracle_thesis_knowledge_links
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR thesis_id IN (SELECT id FROM oracle_theses WHERE profile_id = auth.uid())
  );

CREATE POLICY update_oracle_thesis_knowledge_links ON oracle_thesis_knowledge_links
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR thesis_id IN (SELECT id FROM oracle_theses WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR thesis_id IN (SELECT id FROM oracle_theses WHERE profile_id = auth.uid())
  );

CREATE POLICY delete_oracle_thesis_knowledge_links ON oracle_thesis_knowledge_links
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR thesis_id IN (SELECT id FROM oracle_theses WHERE profile_id = auth.uid())
  );
