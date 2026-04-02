-- Charter Slice 01: Payouts
-- Monetary distributions from rights or obligations
-- Tracks approval workflow and disbursement status

CREATE TYPE payout_status AS ENUM ('pending', 'approved', 'disbursed', 'rejected');

CREATE TABLE charter_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  entity_id uuid NOT NULL REFERENCES charter_entities (id) ON DELETE CASCADE,
  right_id uuid REFERENCES charter_rights (id) ON DELETE SET NULL,
  obligation_id uuid REFERENCES charter_obligations (id) ON DELETE SET NULL,

  -- Amount & currency
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'USD',

  -- Lifecycle
  payout_date date,
  status payout_status NOT NULL DEFAULT 'pending',

  -- Approval trail
  approved_by uuid,

  -- Confidence & audit
  confidence int DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  created_by uuid NOT NULL,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_charter_payouts_entity_id ON charter_payouts (entity_id);
CREATE INDEX idx_charter_payouts_right_id ON charter_payouts (right_id);
CREATE INDEX idx_charter_payouts_obligation_id ON charter_payouts (obligation_id);
CREATE INDEX idx_charter_payouts_status ON charter_payouts (status);
CREATE INDEX idx_charter_payouts_payout_date ON charter_payouts (payout_date);
CREATE INDEX idx_charter_payouts_approved_by ON charter_payouts (approved_by);
CREATE INDEX idx_charter_payouts_created_by ON charter_payouts (created_by);
CREATE INDEX idx_charter_payouts_created_at ON charter_payouts (created_at DESC);

-- RLS
ALTER TABLE charter_payouts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all payouts
CREATE POLICY charter_payouts_read ON charter_payouts
  FOR SELECT TO authenticated
  USING (true);

-- Only service_role can write
CREATE POLICY charter_payouts_write ON charter_payouts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE charter_payouts IS
  'Charter Slice 01: Payouts (monetary distributions). Tracks approval and disbursement.';
