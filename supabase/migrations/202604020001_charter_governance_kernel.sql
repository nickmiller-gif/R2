-- Charter Slice 01: Governance Kernel Base Tables
-- Migration: 202604020001

-- Governance entity types
CREATE TYPE governance_entity_kind AS ENUM (
  'charter',
  'policy',
  'rule',
  'amendment'
);

-- Governance status
CREATE TYPE governance_status AS ENUM (
  'draft',
  'active',
  'superseded',
  'revoked'
);

-- Governance kernel entities table
CREATE TABLE charter_governance_entities (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          governance_entity_kind  NOT NULL,
  status        governance_status       NOT NULL DEFAULT 'draft',
  ref_code      TEXT        NOT NULL UNIQUE,
  title         TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  version       INTEGER     NOT NULL DEFAULT 1,
  parent_id     UUID        REFERENCES charter_governance_entities(id),
  created_by    UUID        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Governance kernel transitions (lifecycle events)
CREATE TABLE charter_governance_transitions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     UUID        NOT NULL REFERENCES charter_governance_entities(id),
  from_status   governance_status,
  to_status     governance_status NOT NULL,
  reason        TEXT,
  actor_id      UUID        NOT NULL,
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gov_entities_kind   ON charter_governance_entities(kind);
CREATE INDEX idx_gov_entities_status ON charter_governance_entities(status);
CREATE INDEX idx_gov_entities_ref    ON charter_governance_entities(ref_code);
CREATE INDEX idx_gov_transitions_entity ON charter_governance_transitions(entity_id);

-- Row-level security
ALTER TABLE charter_governance_entities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE charter_governance_transitions ENABLE ROW LEVEL SECURITY;
