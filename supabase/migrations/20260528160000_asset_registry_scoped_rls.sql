-- Scope asset_registry reads: admin sees all; members see own user_id or group-shared rows.
-- Depends on eigen_access_groups (20260528150000) when access_group_id is used.

-- ── Column: group sharing on assets ─────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.eigen_access_groups') IS NOT NULL THEN
    ALTER TABLE public.asset_registry
      ADD COLUMN IF NOT EXISTS access_group_id uuid
      REFERENCES public.eigen_access_groups (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_asset_registry_access_group
  ON public.asset_registry (access_group_id)
  WHERE access_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asset_registry_user_id
  ON public.asset_registry (user_id);

-- Backfill owner from documents when asset points at a document row.
UPDATE public.asset_registry ar
SET user_id = d.owner_id,
    updated_at = now()
FROM public.documents d
WHERE ar.local_table = 'documents'
  AND ar.local_record_id = d.id
  AND d.owner_id IS NOT NULL
  AND ar.user_id IS DISTINCT FROM d.owner_id;

-- ── Visibility helper (SECURITY DEFINER — reads membership without RLS recursion) ──

CREATE OR REPLACE FUNCTION public.asset_registry_visible_to_user(
  p_user_id uuid,
  p_asset_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asset_registry ar
    WHERE ar.id = p_asset_id
      AND (
        EXISTS (
          SELECT 1
          FROM public.charter_user_roles cur
          WHERE cur.user_id = p_user_id
            AND cur.role::text = 'admin'
        )
        OR ar.user_id = p_user_id
        OR (
          ar.access_group_id IS NOT NULL
          AND to_regclass('public.eigen_access_group_members') IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.eigen_access_group_members m
            WHERE m.group_id = ar.access_group_id
              AND m.user_id = p_user_id
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.asset_registry_visible_to_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.asset_registry_visible_to_user(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.asset_registry_visible_to_user IS
  'True when p_user_id may read asset_registry row p_asset_id (admin, owner, or group member).';

-- ── asset_registry RLS ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS asset_registry_read ON public.asset_registry;

CREATE POLICY asset_registry_scoped_read ON public.asset_registry
  FOR SELECT TO authenticated
  USING (
    public.asset_registry_visible_to_user((SELECT auth.uid()), id)
  );

-- ── asset_evidence_links RLS (both endpoints must be visible) ───────────────
-- Production may use asset_evidence_links (plural) or asset_evidence_link (singular).

DO $$
BEGIN
  IF to_regclass('public.asset_evidence_links') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS evidence_links_read ON public.asset_evidence_links';
    EXECUTE $policy$
      CREATE POLICY asset_evidence_links_scoped_read ON public.asset_evidence_links
        FOR SELECT TO authenticated
        USING (
          public.asset_registry_visible_to_user((SELECT auth.uid()), from_asset_id)
          AND public.asset_registry_visible_to_user((SELECT auth.uid()), to_asset_id)
        )
    $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.asset_evidence_link') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS evidence_links_read ON public.asset_evidence_link';
    EXECUTE 'DROP POLICY IF EXISTS asset_evidence_links_scoped_read ON public.asset_evidence_link';
    EXECUTE 'DROP POLICY IF EXISTS asset_evidence_link_scoped_read ON public.asset_evidence_link';
    EXECUTE $policy$
      CREATE POLICY asset_evidence_link_scoped_read ON public.asset_evidence_link
        FOR SELECT TO authenticated
        USING (
          public.asset_registry_visible_to_user((SELECT auth.uid()), asset_registry_id)
        )
    $policy$;
  END IF;
END $$;

COMMENT ON COLUMN public.asset_registry.access_group_id IS
  'When set, members of this Eigen access group may read the asset (with owner user_id).';
