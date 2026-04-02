-- Charter Slice 01: User Roles
-- RBAC for Charter governance kernel
-- Defines who can do what: members, reviewers, operators, counsel, admins

CREATE TYPE charter_role AS ENUM ('member', 'reviewer', 'operator', 'counsel', 'admin');

CREATE TABLE charter_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User & role
  user_id uuid NOT NULL,
  role charter_role NOT NULL,

  -- Audit trail
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Uniqueness constraint
  UNIQUE(user_id, role)
);

-- Indexes for common query patterns
CREATE INDEX idx_charter_user_roles_user_id ON charter_user_roles (user_id);
CREATE INDEX idx_charter_user_roles_role ON charter_user_roles (role);
CREATE INDEX idx_charter_user_roles_assigned_by ON charter_user_roles (assigned_by);
CREATE INDEX idx_charter_user_roles_created_at ON charter_user_roles (created_at DESC);

-- RLS
ALTER TABLE charter_user_roles ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all role assignments
CREATE POLICY charter_user_roles_read ON charter_user_roles
  FOR SELECT TO authenticated
  USING (true);

-- Only service_role can write
CREATE POLICY charter_user_roles_write ON charter_user_roles
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE charter_user_roles IS
  'Charter Slice 01: User Roles (RBAC). member, reviewer, operator, counsel, admin.';
