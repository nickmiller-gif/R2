-- Align Postgres meg_entity_type with TypeScript MegEntityType ('ip' for IP assets).

ALTER TYPE meg_entity_type ADD VALUE IF NOT EXISTS 'ip';
