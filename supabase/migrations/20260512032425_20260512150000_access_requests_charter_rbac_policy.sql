-- Align access_requests admin SELECT policy with charter_user_roles (portable RBAC).
-- Eigen production may have applied an earlier revision of 20260512030043 that referenced
-- public.app_role / has_role (not created by R2 migrations). Preview branches failed with
-- SQLSTATE 42704 until the base migration was corrected; this migration is idempotent for
-- environments that already had the charter-based policy from the updated 20260512030043 file.

DROP POLICY IF EXISTS "Admins can select access requests" ON public.access_requests;

CREATE POLICY "Admins can select access requests"
  ON public.access_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text = 'admin'
    )
  );
;
