-- Phase 0: Generalize provenance from Charter-scoped to domain-agnostic.
-- Additive only — adds a `domain` column with a default so existing Charter
-- rows remain valid without backfill.

ALTER TABLE charter_provenance_events
  ADD COLUMN IF NOT EXISTS domain text NOT NULL DEFAULT 'charter';

-- Create index for domain-scoped queries
CREATE INDEX IF NOT EXISTS idx_provenance_events_domain
  ON charter_provenance_events (domain);

-- Create composite index for domain + entity lookups
CREATE INDEX IF NOT EXISTS idx_provenance_events_domain_entity
  ON charter_provenance_events (domain, entity_id, recorded_at DESC);

-- Note: We keep the table name as `charter_provenance_events` for now
-- to avoid breaking Charter Slice 01. A future migration can rename it
-- to `provenance_events` once all Charter references are updated.

COMMENT ON COLUMN charter_provenance_events.domain IS
  'Domain that owns this provenance stream (charter, oracle, eigen, etc.)';
