-- EigenX Tool Capabilities
-- Structured tool manifest for policy-aware routing

CREATE TYPE tool_mode AS ENUM ('read', 'write');
CREATE TYPE approval_policy AS ENUM ('none_required', 'user_approval', 'admin_approval');

CREATE TABLE tool_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  capability_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  io_schema_ref TEXT,
  mode tool_mode NOT NULL,
  approval_policy approval_policy NOT NULL DEFAULT 'none_required',
  role_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  connector_dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  blast_radius TEXT,
  fallback_mode TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tool_capabilities_tool_id ON tool_capabilities(tool_id);
CREATE INDEX idx_tool_capabilities_mode ON tool_capabilities(mode);
CREATE INDEX idx_tool_capabilities_approval_policy ON tool_capabilities(approval_policy);

-- Row-Level Security
ALTER TABLE tool_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tool capabilities"
  ON tool_capabilities FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin users can manage tool capabilities"
  ON tool_capabilities FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND current_setting('app.role', true) = 'admin');

CREATE POLICY "Admin users can update tool capabilities"
  ON tool_capabilities FOR UPDATE
  USING (auth.role() = 'authenticated' AND current_setting('app.role', true) = 'admin');
