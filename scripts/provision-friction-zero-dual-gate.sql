-- Provision Friction Zero dual gate for a signed-in auth user (Eigen).
-- Run in Supabase SQL editor (project zudslxucibosjwefojtm) after substituting :user_id.
--
-- Pitfall B1: Lovable publish alone does not grant Works profile or charter role.

-- Replace the UUID below, then run as a single script block.

DO $$
DECLARE
  v_user_id uuid := 'fca0bec7-6d33-475b-ade7-9771879587e3';
BEGIN
  INSERT INTO works.operator_profiles (user_id, display_name, is_active, updated_at)
  VALUES (v_user_id, 'Friction Zero operator', true, now())
  ON CONFLICT (user_id) DO UPDATE SET is_active = true, updated_at = now();

  INSERT INTO public.charter_user_roles (user_id, role)
  VALUES (v_user_id, 'operator')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
