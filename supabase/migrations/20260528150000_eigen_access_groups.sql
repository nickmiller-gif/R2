-- EigenX access groups: shared policy scope for members (eigenx:group:<uuid>).
-- Admins see org-wide corpus via EIGENX_FULL_ACCESS_ROLES; regular members see
-- personal tag + tags for groups they belong to.

CREATE TABLE IF NOT EXISTS public.eigen_access_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eigen_access_groups_slug_unique UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.eigen_access_group_members (
  group_id uuid NOT NULL REFERENCES public.eigen_access_groups (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_eigen_access_group_members_user
  ON public.eigen_access_group_members (user_id);

CREATE INDEX IF NOT EXISTS idx_eigen_access_groups_status
  ON public.eigen_access_groups (status);

ALTER TABLE public.eigen_access_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eigen_access_group_members ENABLE ROW LEVEL SECURITY;

-- Members can read groups they belong to.
CREATE POLICY eigen_access_groups_member_read ON public.eigen_access_groups
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.eigen_access_group_members m
      WHERE m.group_id = id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY eigen_access_group_members_own_read ON public.eigen_access_group_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- All mutations via service_role (edge functions + admin RBAC).
CREATE POLICY eigen_access_groups_service_write ON public.eigen_access_groups
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY eigen_access_group_members_service_write ON public.eigen_access_group_members
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.eigen_access_groups IS
  'Shared EigenX access groups; chunks tagged eigenx:group:<id> are visible to members.';
COMMENT ON TABLE public.eigen_access_group_members IS
  'Membership linking Supabase users to eigen_access_groups.';
