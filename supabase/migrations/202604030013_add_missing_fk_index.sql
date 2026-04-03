-- Add missing foreign key index on asset_evidence_links.to_asset_id
-- Complements the existing idx_evidence_links_from on from_asset_id
-- for efficient reverse-direction lookups (e.g. "what links point TO this asset?")

CREATE INDEX IF NOT EXISTS idx_evidence_links_to_asset_id
  ON asset_evidence_links (to_asset_id);
