-- Link Charter evidence and decisions directly to asset valuation records (MEG-anchored values).

ALTER TYPE evidence_linked_table ADD VALUE IF NOT EXISTS 'asset_valuations';
ALTER TYPE decision_linked_table ADD VALUE IF NOT EXISTS 'asset_valuations';
