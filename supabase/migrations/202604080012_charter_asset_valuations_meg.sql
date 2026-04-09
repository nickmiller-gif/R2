-- Charter asset valuations: canonical economic / book / insurance values on MEG-classified assets.
-- Primary key to reality: meg_entities.id (person, org, property, product, concept, location, ip).
-- Optional charter_entities.id when a governance record exists for the same subject.

ALTER TYPE meg_entity_type ADD VALUE IF NOT EXISTS 'ip';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'ip';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'concept';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'location';

CREATE TYPE charter_valuation_kind AS ENUM (
  'market',
  'book',
  'insurance',
  'replacement',
  'liquidation',
  'income_approach',
  'charter_basis',
  'tax_assessment',
  'custom'
);

CREATE TYPE charter_valuation_status AS ENUM ('draft', 'active', 'superseded');

CREATE TABLE charter_asset_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  meg_entity_id UUID NOT NULL REFERENCES meg_entities (id) ON DELETE RESTRICT,
  charter_entity_id UUID REFERENCES charter_entities (id) ON DELETE SET NULL,

  valuation_kind charter_valuation_kind NOT NULL,
  amount_numeric NUMERIC(24, 6) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  as_of TIMESTAMPTZ NOT NULL,

  confidence INT NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  methodology TEXT,
  basis_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  status charter_valuation_status NOT NULL DEFAULT 'draft',
  supersedes_id UUID REFERENCES charter_asset_valuations (id) ON DELETE SET NULL,

  created_by UUID NOT NULL,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_charter_asset_valuations_meg_entity
  ON charter_asset_valuations (meg_entity_id);
CREATE INDEX idx_charter_asset_valuations_charter_entity
  ON charter_asset_valuations (charter_entity_id)
  WHERE charter_entity_id IS NOT NULL;
CREATE INDEX idx_charter_asset_valuations_status_as_of
  ON charter_asset_valuations (status, as_of DESC);
CREATE INDEX idx_charter_asset_valuations_kind
  ON charter_asset_valuations (valuation_kind);

ALTER TABLE charter_asset_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY charter_asset_valuations_read ON charter_asset_valuations
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY charter_asset_valuations_write ON charter_asset_valuations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE charter_asset_valuations IS
  'Charter: recorded valuations for assets identified by MEG entity type (person, org, property, product, concept, location, ip). Optional link to charter_entities for governance workflow.';
