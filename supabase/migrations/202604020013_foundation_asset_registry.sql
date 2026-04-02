-- Phase 0: Asset registry + evidence links — entity graph primitives.
-- Connects ideas, documents, signals, and governance entities
-- into an auditable evidence graph.

CREATE TYPE asset_kind AS ENUM (
  'idea_submission', 'document', 'oracle_signal',
  'governance_entity', 'work', 'contract', 'account', 'project'
);

CREATE TYPE evidence_link_kind AS ENUM (
  'supports', 'contradicts', 'derived_from',
  'references', 'supersedes', 'scored_by'
);

CREATE TABLE asset_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind asset_kind NOT NULL,
  ref_id uuid NOT NULL,
  domain text NOT NULL,
  label text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one registry entry per (kind, ref_id, domain)
CREATE UNIQUE INDEX idx_asset_registry_unique
  ON asset_registry (kind, ref_id, domain);

CREATE INDEX idx_asset_registry_kind ON asset_registry (kind);
CREATE INDEX idx_asset_registry_domain ON asset_registry (domain);
CREATE INDEX idx_asset_registry_ref_id ON asset_registry (ref_id);

CREATE TABLE asset_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_asset_id uuid NOT NULL REFERENCES asset_registry(id),
  to_asset_id uuid NOT NULL REFERENCES asset_registry(id),
  link_kind evidence_link_kind NOT NULL,
  confidence numeric(3, 2) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate links
  CONSTRAINT unique_evidence_link UNIQUE (from_asset_id, to_asset_id, link_kind)
);

CREATE INDEX idx_evidence_links_from ON asset_evidence_links (from_asset_id);
CREATE INDEX idx_evidence_links_to ON asset_evidence_links (to_asset_id);
CREATE INDEX idx_evidence_links_kind ON asset_evidence_links (link_kind);

-- RLS
ALTER TABLE asset_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_evidence_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_registry_read ON asset_registry
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY asset_registry_write ON asset_registry
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY evidence_links_read ON asset_evidence_links
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY evidence_links_write ON asset_evidence_links
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE asset_registry IS
  'Canonical registry for any entity that participates in the evidence graph.';
COMMENT ON TABLE asset_evidence_links IS
  'Typed evidence relationships between registered assets.';
