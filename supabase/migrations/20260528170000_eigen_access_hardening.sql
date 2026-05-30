-- EigenX access hardening: documents RLS, shared full-access helper, MEG RPC gate,
-- knowledge_chunks read alignment, r2_core_asset_evidence_links scoping.

-- ── Shared full-access helper (mirror EIGENX_FULL_ACCESS_ROLES default: admin) ──

CREATE OR REPLACE FUNCTION public.user_has_eigen_full_access(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.charter_user_roles cur
    WHERE cur.user_id = p_user_id
      AND cur.role::text = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_eigen_full_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_eigen_full_access(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.user_has_eigen_full_access IS
  'True when p_user_id has org-wide EigenX access (charter admin). Align with EIGENX_FULL_ACCESS_ROLES.';

-- ── documents: group sharing column ───────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.eigen_access_groups') IS NOT NULL THEN
    ALTER TABLE public.documents
      ADD COLUMN IF NOT EXISTS access_group_id uuid
      REFERENCES public.eigen_access_groups (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_access_group
  ON public.documents (access_group_id)
  WHERE access_group_id IS NOT NULL;

-- ── documents visibility ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.documents_visible_to_user(
  p_user_id uuid,
  p_document_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = p_document_id
      AND (
        public.user_has_eigen_full_access(p_user_id)
        OR d.owner_id = p_user_id
        OR (
          d.access_group_id IS NOT NULL
          AND to_regclass('public.eigen_access_group_members') IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.eigen_access_group_members m
            WHERE m.group_id = d.access_group_id
              AND m.user_id = p_user_id
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.documents_visible_to_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.documents_visible_to_user(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.documents_visible_to_user IS
  'True when p_user_id may read documents row p_document_id (admin, owner, or group member).';

DROP POLICY IF EXISTS documents_read ON public.documents;

CREATE POLICY documents_scoped_read ON public.documents
  FOR SELECT TO authenticated
  USING (
    public.documents_visible_to_user((SELECT auth.uid()), id)
  );

COMMENT ON COLUMN public.documents.access_group_id IS
  'When set, members of this Eigen access group may read the document (with owner).';

-- ── knowledge_chunks: align read with document visibility ─────────────────────

DROP POLICY IF EXISTS "Users can read knowledge chunks for their documents" ON public.knowledge_chunks;

CREATE POLICY knowledge_chunks_scoped_read ON public.knowledge_chunks
  FOR SELECT TO authenticated
  USING (
    public.documents_visible_to_user((SELECT auth.uid()), document_id)
  );

-- ── asset_registry: use shared full-access helper ─────────────────────────────

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
        public.user_has_eigen_full_access(p_user_id)
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

-- ── MEG entity visibility ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.meg_entity_visible_to_user(
  p_user_id uuid,
  p_entity_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meg_entities m
    WHERE m.id = p_entity_id
      AND (
        public.is_active_operator(p_user_id)
        OR m.profile_id = p_user_id
      )
  );
$$;

REVOKE ALL ON FUNCTION public.meg_entity_visible_to_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meg_entity_visible_to_user(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.meg_entity_visible_to_user IS
  'True when p_user_id may read meg_entities row p_entity_id (operator or profile owner).';

CREATE OR REPLACE FUNCTION public.meg_entity_full_context(p_meg_entity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity jsonb;
  v_sources jsonb;
  v_edges jsonb;
  v_caller uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NOT NULL
     AND NOT public.meg_entity_visible_to_user(v_caller, p_meg_entity_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT to_jsonb(m.*) INTO v_entity
  FROM public.meg_entities m
  WHERE m.id = p_meg_entity_id;

  IF v_entity IS NULL THEN
    RETURN jsonb_build_object('error', 'meg_entity_not_found');
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(s.*)), '[]'::jsonb) INTO v_sources
  FROM public.meg_entity_source_refs s
  WHERE s.meg_entity_id = p_meg_entity_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'edge_type', e.edge_type,
      'direction', CASE WHEN e.source_entity_id = p_meg_entity_id THEN 'out' ELSE 'in' END,
      'other_meg_entity_id',
        CASE WHEN e.source_entity_id = p_meg_entity_id THEN e.target_entity_id ELSE e.source_entity_id END,
      'confidence', e.confidence,
      'source', e.source,
      'metadata', e.metadata
  )), '[]'::jsonb) INTO v_edges
  FROM public.meg_entity_edges e
  WHERE e.source_entity_id = p_meg_entity_id
     OR e.target_entity_id = p_meg_entity_id;

  RETURN jsonb_build_object(
    'meg_entity', v_entity,
    'source_refs', v_sources,
    'meg_entity_edges', v_edges
  );
END;
$$;

REVOKE ALL ON FUNCTION public.meg_entity_full_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meg_entity_full_context(uuid) TO service_role, authenticated;

-- ── r2_core_asset_evidence_links (workbench table) ──────────────────────────

DO $$
BEGIN
  IF to_regclass('public.r2_core_asset_evidence_links') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.r2_core_asset_evidence_links ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS r2_core_evidence_links_read ON public.r2_core_asset_evidence_links';
    EXECUTE 'DROP POLICY IF EXISTS asset_evidence_links_read ON public.r2_core_asset_evidence_links';
    EXECUTE $policy$
      CREATE POLICY r2_core_asset_evidence_links_scoped_read ON public.r2_core_asset_evidence_links
        FOR SELECT TO authenticated
        USING (
          public.asset_registry_visible_to_user((SELECT auth.uid()), from_asset_id)
          AND public.asset_registry_visible_to_user((SELECT auth.uid()), to_asset_id)
        )
    $policy$;
  END IF;
END $$;
