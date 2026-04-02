-- Charter Slice 01: Evidence
-- Documents, photos, filings, testimony linked to entities, rights, obligations
-- Supports provenance tracking and audit verification

CREATE TYPE evidence_type AS ENUM ('document', 'photo', 'filing', 'testimony');
CREATE TYPE evidence_status AS ENUM ('submitted', 'verified', 'challenged');
CREATE TYPE evidence_linked_table AS ENUM ('entities', 'rights', 'obligations', 'payouts', 'decisions', 'ip_matters');

CREATE TABLE charter_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic reference
  linked_table evidence_linked_table NOT NULL,
  linked_id uuid NOT NULL,

  -- Evidence classification
  evidence_type evidence_type NOT NULL,
  title text NOT NULL,
  storage_path text,
  metadata jsonb DEFAULT '{}',
  status evidence_status NOT NULL DEFAULT 'submitted',

  -- Confidence & provenance
  confidence int DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  canonical_entity_id uuid,
  provenance_record_id uuid,

  -- Audit trail
  created_by uuid NOT NULL,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_charter_evidence_linked_table_id ON charter_evidence (linked_table, linked_id);
CREATE INDEX idx_charter_evidence_status ON charter_evidence (status);
CREATE INDEX idx_charter_evidence_evidence_type ON charter_evidence (evidence_type);
CREATE INDEX idx_charter_evidence_canonical_entity_id ON charter_evidence (canonical_entity_id);
CREATE INDEX idx_charter_evidence_provenance_record_id ON charter_evidence (provenance_record_id);
CREATE INDEX idx_charter_evidence_created_by ON charter_evidence (created_by);
CREATE INDEX idx_charter_evidence_created_at ON charter_evidence (created_at DESC);

-- RLS
ALTER TABLE charter_evidence ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all evidence
CREATE POLICY charter_evidence_read ON charter_evidence
  FOR SELECT TO authenticated
  USING (true);

-- Only service_role can write
CREATE POLICY charter_evidence_write ON charter_evidence
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE charter_evidence IS
  'Charter Slice 01: Evidence (documents, photos, filings, testimony). Polymorphic linking with provenance.';
