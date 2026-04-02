-- Charter Slice 01: Rights
-- Licenses, leases, approvals, and other entitlements linked to entities
-- Governs what an entity can do or is permitted to do

CREATE TYPE right_type AS ENUM ('nil', 'license', 'lease', 'approval');
CREATE TYPE right_status AS ENUM ('pending', 'active', 'expired', 'revoked');

CREATE TABLE charter_rights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to entity
  entity_id uuid NOT NULL REFERENCES charter_entities (id) ON DELETE CASCADE,

  -- Right classification
  right_type right_type NOT NULL,
  title text NOT NULL,
  description text,

  -- Lifecycle
  effective_date date,
  expiry_date date,
  status right_status NOT NULL DEFAULT 'pending',

  -- Confidence & audit
  confidence int DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  created_by uuid NOT NULL,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_charter_rights_entity_id ON charter_rights (entity_id);
CREATE INDEX idx_charter_rights_status ON charter_rights (status);
CREATE INDEX idx_charter_rights_right_type ON charter_rights (right_type);
CREATE INDEX idx_charter_rights_expiry_date ON charter_rights (expiry_date);
CREATE INDEX idx_charter_rights_created_by ON charter_rights (created_by);
CREATE INDEX idx_charter_rights_created_at ON charter_rights (created_at DESC);

-- RLS
ALTER TABLE charter_rights ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all rights
CREATE POLICY charter_rights_read ON charter_rights
  FOR SELECT TO authenticated
  USING (true);

-- Only service_role can write
CREATE POLICY charter_rights_write ON charter_rights
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE charter_rights IS
  'Charter Slice 01: Rights (licenses, leases, approvals) linked to entities. Governs entitlements.';
