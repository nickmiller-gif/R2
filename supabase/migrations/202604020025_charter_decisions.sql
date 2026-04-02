-- Charter Slice 01: Decisions
-- Approvals, rejections, escalations, overrides on entities, rights, obligations
-- Audit-critical: every decision is recorded with rationale and outcome

CREATE TYPE decision_type AS ENUM ('approval', 'rejection', 'escalation', 'override');
CREATE TYPE decision_status AS ENUM ('pending', 'final', 'appealed');
CREATE TYPE decision_linked_table AS ENUM ('entities', 'rights', 'obligations', 'payouts', 'evidence', 'ip_matters');

CREATE TABLE charter_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic reference
  linked_table decision_linked_table NOT NULL,
  linked_id uuid NOT NULL,

  -- Decision classification
  decision_type decision_type NOT NULL,
  title text NOT NULL,
  rationale text,
  outcome jsonb DEFAULT '{}',
  status decision_status NOT NULL DEFAULT 'pending',

  -- Decision maker & timestamp
  decided_by uuid,
  decided_at timestamptz,

  -- Confidence & audit
  confidence int DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  created_by uuid NOT NULL,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_charter_decisions_linked_table_id ON charter_decisions (linked_table, linked_id);
CREATE INDEX idx_charter_decisions_status ON charter_decisions (status);
CREATE INDEX idx_charter_decisions_decision_type ON charter_decisions (decision_type);
CREATE INDEX idx_charter_decisions_decided_by ON charter_decisions (decided_by);
CREATE INDEX idx_charter_decisions_decided_at ON charter_decisions (decided_at DESC);
CREATE INDEX idx_charter_decisions_created_by ON charter_decisions (created_by);
CREATE INDEX idx_charter_decisions_created_at ON charter_decisions (created_at DESC);

-- RLS
ALTER TABLE charter_decisions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all decisions
CREATE POLICY charter_decisions_read ON charter_decisions
  FOR SELECT TO authenticated
  USING (true);

-- Only service_role can write
CREATE POLICY charter_decisions_write ON charter_decisions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE charter_decisions IS
  'Charter Slice 01: Decisions (approvals, rejections, escalations, overrides). Audit-critical.';
