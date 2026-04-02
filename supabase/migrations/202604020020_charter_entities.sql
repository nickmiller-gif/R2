-- Charter Slice 01: Entities
-- Core entity types for governance kernel: persons, orgs, properties, products
-- Tracks canonical references, context linking, and entity lifecycle

CREATE TYPE entity_type AS ENUM ('person', 'org', 'property', 'product');
CREATE TYPE entity_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE charter_context_status AS ENUM ('unlinked', 'linked', 'stale', 'error');

CREATE TABLE charter_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity classification
  entity_type entity_type NOT NULL,
  name text NOT NULL,
  metadata jsonb DEFAULT '{}',
  status entity_status NOT NULL DEFAULT 'draft',

  -- Confidence & provenance
  confidence int DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  source_platform text,
  source_record_id text,

  -- MEG integration
  canonical_entity_id uuid,

  -- Context linking
  context_status charter_context_status NOT NULL DEFAULT 'unlinked',
  last_context_sync_at timestamptz,

  -- Audit trail
  created_by uuid NOT NULL,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_charter_entities_entity_type ON charter_entities (entity_type);
CREATE INDEX idx_charter_entities_status ON charter_entities (status);
CREATE INDEX idx_charter_entities_canonical_entity_id ON charter_entities (canonical_entity_id);
CREATE INDEX idx_charter_entities_context_status ON charter_entities (context_status);
CREATE INDEX idx_charter_entities_created_by ON charter_entities (created_by);
CREATE INDEX idx_charter_entities_created_at ON charter_entities (created_at DESC);

-- RLS
ALTER TABLE charter_entities ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all entities
CREATE POLICY charter_entities_read ON charter_entities
  FOR SELECT TO authenticated
  USING (true);

-- Only service_role can write (edge functions handle auth)
CREATE POLICY charter_entities_write ON charter_entities
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE charter_entities IS
  'Charter Slice 01: Canonical entity table for persons, orgs, properties, products. MEG-linked.';
