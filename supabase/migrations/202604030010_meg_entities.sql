-- MEG (Master Entity Graph) — Canonical identity layer
-- Every real-world entity gets a single MEG node. Domain objects
-- (Charter, Oracle, Eigen) reference MEG entities for unified identity.

-- ── Enums ───────────────────────────────────────────────────────────

CREATE TYPE meg_entity_type AS ENUM (
  'person',
  'org',
  'property',
  'product',
  'concept',
  'location'
);

CREATE TYPE meg_entity_status AS ENUM (
  'active',
  'merged',
  'archived'
);

CREATE TYPE meg_alias_kind AS ENUM (
  'slug',
  'external_id',
  'display_name',
  'shortcode',
  'legal_name',
  'dba'
);

CREATE TYPE meg_edge_type AS ENUM (
  'owns',
  'employs',
  'subsidiary_of',
  'partner_of',
  'located_at',
  'related_to',
  'derived_from',
  'supersedes'
);

-- ── MEG Entities ────────────────────────────────────────────────────

CREATE TABLE meg_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type meg_entity_type NOT NULL,
  canonical_name TEXT NOT NULL,
  status meg_entity_status NOT NULL DEFAULT 'active',
  merged_into_id UUID REFERENCES meg_entities(id) ON DELETE SET NULL,
  external_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meg_entities_profile_id ON meg_entities(profile_id);
CREATE INDEX idx_meg_entities_entity_type ON meg_entities(entity_type);
CREATE INDEX idx_meg_entities_status ON meg_entities(status);
CREATE INDEX idx_meg_entities_canonical_name ON meg_entities USING gin (canonical_name gin_trgm_ops);
CREATE INDEX idx_meg_entities_merged_into_id ON meg_entities(merged_into_id);
CREATE INDEX idx_meg_entities_created_at ON meg_entities(created_at DESC);

ALTER TABLE meg_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_meg_entities ON meg_entities
  FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_meg_entities ON meg_entities
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR profile_id = auth.uid());

CREATE POLICY update_meg_entities ON meg_entities
  FOR UPDATE
  USING (auth.role() = 'service_role' OR profile_id = auth.uid())
  WITH CHECK (auth.role() = 'service_role' OR profile_id = auth.uid());

CREATE POLICY delete_meg_entities ON meg_entities
  FOR DELETE
  USING (auth.role() = 'service_role' OR profile_id = auth.uid());

-- ── MEG Entity Aliases ──────────────────────────────────────────────

CREATE TABLE meg_entity_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meg_entity_id UUID NOT NULL REFERENCES meg_entities(id) ON DELETE CASCADE,
  alias_kind meg_alias_kind NOT NULL,
  alias_value TEXT NOT NULL,
  source TEXT,
  confidence INTEGER NOT NULL DEFAULT 100,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meg_entity_aliases_meg_entity_id ON meg_entity_aliases(meg_entity_id);
CREATE INDEX idx_meg_entity_aliases_alias_value ON meg_entity_aliases USING gin (alias_value gin_trgm_ops);
CREATE INDEX idx_meg_entity_aliases_kind_value ON meg_entity_aliases(alias_kind, alias_value);

ALTER TABLE meg_entity_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_meg_entity_aliases ON meg_entity_aliases
  FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_meg_entity_aliases ON meg_entity_aliases
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR meg_entity_id IN (SELECT id FROM meg_entities WHERE profile_id = auth.uid())
  );

CREATE POLICY update_meg_entity_aliases ON meg_entity_aliases
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR meg_entity_id IN (SELECT id FROM meg_entities WHERE profile_id = auth.uid())
  );

CREATE POLICY delete_meg_entity_aliases ON meg_entity_aliases
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR meg_entity_id IN (SELECT id FROM meg_entities WHERE profile_id = auth.uid())
  );

-- ── MEG Entity Edges ────────────────────────────────────────────────

CREATE TABLE meg_entity_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID NOT NULL REFERENCES meg_entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES meg_entities(id) ON DELETE CASCADE,
  edge_type meg_edge_type NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 100,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  source TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_edges CHECK (source_entity_id != target_entity_id)
);

CREATE INDEX idx_meg_entity_edges_source ON meg_entity_edges(source_entity_id);
CREATE INDEX idx_meg_entity_edges_target ON meg_entity_edges(target_entity_id);
CREATE INDEX idx_meg_entity_edges_type ON meg_entity_edges(edge_type);
CREATE INDEX idx_meg_entity_edges_source_type ON meg_entity_edges(source_entity_id, edge_type);

ALTER TABLE meg_entity_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_meg_entity_edges ON meg_entity_edges
  FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_meg_entity_edges ON meg_entity_edges
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR source_entity_id IN (SELECT id FROM meg_entities WHERE profile_id = auth.uid())
  );

CREATE POLICY update_meg_entity_edges ON meg_entity_edges
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR source_entity_id IN (SELECT id FROM meg_entities WHERE profile_id = auth.uid())
  );

CREATE POLICY delete_meg_entity_edges ON meg_entity_edges
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR source_entity_id IN (SELECT id FROM meg_entities WHERE profile_id = auth.uid())
  );
