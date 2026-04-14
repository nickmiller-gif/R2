-- Admin bootstrap seed — creates the first admin role assignment to avoid
-- bootstrap lockout (RLS-AUDIT-PHASE-B.md, Finding 2 / Action Item 2).
--
-- Problem: requireRole('admin') guards the charter-roles POST endpoint, so
-- no one can assign the first admin role through the API. This migration
-- provides a safe, idempotent procedure to seed the first admin from a
-- known user ID stored in a Postgres setting or passed as a parameter.
--
-- Usage after applying this migration:
--   SELECT public.bootstrap_admin_role('<supabase-user-uuid>');
--
-- The function is intentionally restricted to service_role callers and is
-- idempotent — re-calling with the same user_id is a no-op.

CREATE OR REPLACE FUNCTION public.bootstrap_admin_role(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already_admin boolean;
BEGIN
  -- Verify the user exists in auth.users (prevents dangling role rows)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User % not found in auth.users', p_user_id;
  END IF;

  -- Check if the user already holds an admin role
  SELECT EXISTS (
    SELECT 1
    FROM public.charter_user_roles
    WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_already_admin;

  IF v_already_admin THEN
    RETURN 'already_admin';
  END IF;

  -- Insert the admin role assignment
  INSERT INTO public.charter_user_roles (user_id, role, assigned_by)
  VALUES (p_user_id, 'admin', p_user_id);

  RETURN 'bootstrapped';
END;
$$;

-- Restrict execution to service_role only (anon and authenticated cannot call this)
REVOKE ALL ON FUNCTION public.bootstrap_admin_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bootstrap_admin_role(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin_role(uuid) TO service_role;

COMMENT ON FUNCTION public.bootstrap_admin_role(uuid) IS
  'Seeds the first admin role for p_user_id. Idempotent. '
  'Callable only by service_role. '
  'Resolves admin bootstrap lockout when no admin row exists yet.';
