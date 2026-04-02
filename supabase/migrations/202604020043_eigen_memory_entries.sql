-- EigenX Memory Entries
-- Segmented memory with retention and confidence

CREATE TYPE memory_scope AS ENUM ('session', 'user', 'workspace');
CREATE TYPE retention_class AS ENUM ('ephemeral', 'short_term', 'long_term', 'permanent');

CREATE TABLE memory_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope memory_scope NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  retention_class retention_class NOT NULL DEFAULT 'short_term',
  expires_at TIMESTAMPTZ,
  confidence_band TEXT NOT NULL DEFAULT 'medium',
  conflict_group TEXT,
  superseded_by UUID REFERENCES memory_entries(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(scope, owner_id, key)
);

CREATE INDEX idx_memory_entries_owner_id ON memory_entries(owner_id);
CREATE INDEX idx_memory_entries_scope ON memory_entries(scope);
CREATE INDEX idx_memory_entries_key ON memory_entries(key);
CREATE INDEX idx_memory_entries_retention_class ON memory_entries(retention_class);
CREATE INDEX idx_memory_entries_expires_at ON memory_entries(expires_at);
CREATE INDEX idx_memory_entries_conflict_group ON memory_entries(conflict_group);

-- Row-Level Security
ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own memory entries"
  ON memory_entries FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert memory entries"
  ON memory_entries FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own memory entries"
  ON memory_entries FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own memory entries"
  ON memory_entries FOR DELETE
  USING (owner_id = auth.uid());
