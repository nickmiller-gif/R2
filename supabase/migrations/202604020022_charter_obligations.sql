-- Charter Slice 01: Obligations
-- Payments, filings, compliance, and delivery obligations
-- Often tied to rights, tracks what entities must do

CREATE TYPE obligation_type AS ENUM ('payment', 'filing', 'compliance', 'delivery');
CREATE TYPE obligation_status AS ENUM ('pending', 'fulfilled', 'overdue', 'waived');

CREATE TABLE charter_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  entity_id uuid NOT NULL REFERENCES charter_entities (id) ON DELETE CASCADE,
  right_id uuid REFERENCES charter_rights (id) ON DELETE SET NULL,

  -- Obligation classification
  obligation_type obligation_type NOT NULL,
  title text NOT NULL,
  description text,

  -- Lifecycle
  due_date date,
  status obligation_status NOT NULL DEFAULT 'pending',

  -- Confidence & audit
  confidence int DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  created_by uuid NOT NULL,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_charter_obligations_entity_id ON charter_obligations (entity_id);
CREATE INDEX idx_charter_obligations_right_id ON charter_obligations (right_id);
CREATE INDEX idx_charter_obligations_status ON charter_obligations (status);
CREATE INDEX idx_charter_obligations_obligation_type ON charter_obligations (obligation_type);
CREATE INDEX idx_charter_obligations_due_date ON charter_obligations (due_date);
CREATE INDEX idx_charter_obligations_created_by ON charter_obligations (created_by);
CREATE INDEX idx_charter_obligations_created_at ON charter_obligations (created_at DESC);

-- RLS
ALTER TABLE charter_obligations ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all obligations
CREATE POLICY charter_obligations_read ON charter_obligations
  FOR SELECT TO authenticated
  USING (true);

-- Only service_role can write
CREATE POLICY charter_obligations_write ON charter_obligations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE charter_obligations IS
  'Charter Slice 01: Obligations (payments, filings, compliance, delivery). Often tied to rights.';
