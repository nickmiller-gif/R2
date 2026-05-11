-- Eigen Site Registry: register oracle-operator as a mixed-mode operator console.
--
-- ADR: ../../../docs/adr/ADR-0006-brand-site-seo-baseline.md (Hotspot 3)
-- Plan: ../../../R2-Drift-Resolution-Plan.md § Hotspot 3
--
-- Context (R2 Unification Audit, 2026-05-10):
--   oracle-operator was found running with 100% Lovable scaffold boilerplate
--   in index.html (title "Lovable App", og:image at lovable.dev). The
--   boilerplate has been replaced with real R2 metadata + WebApplication
--   JSON-LD; this migration registers the surface in eigen_site_registry so
--   the eigen-widget-session edge function can issue tokens to it.
--
-- Source-system literal already in catalog: 'oracle_operator' (v1.0.0).
-- Site_id chosen: 'oracle-operator' (matches Lovable host slug pattern,
--   matches the existing repo directory name).
-- Mode: mixed (operator console — public scope by default; bearer upgrades
--   are handled by session policy, not by listing eigenx in default_policy_scope).
-- Constraint eigen_site_registry_scope_mode_consistency: mixed rows must not
-- include eigenx in default_policy_scope (see 202604200001).
--
-- Idempotent: ON CONFLICT (site_id) DO UPDATE.

INSERT INTO public.eigen_site_registry (
  site_id,
  display_name,
  mode,
  origins,
  source_systems,
  default_policy_scope,
  status,
  metadata
)
VALUES (
  'oracle-operator',
  'Oracle Operator',
  'mixed',
  '["https://oracle-operator.lovable.app", "http://localhost:5173", "http://localhost:8080"]'::jsonb,
  '["oracle_operator"]'::jsonb,
  '["eigen_public"]'::jsonb,
  'active',
  '{"description":"Operator console for the R2 Oracle white-space intelligence pipeline. Replaces the Lovable scaffold boilerplate that was in place 2026-04 → 2026-05.","domains":[]}'::jsonb
)
ON CONFLICT (site_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  mode = EXCLUDED.mode,
  origins = EXCLUDED.origins,
  source_systems = EXCLUDED.source_systems,
  default_policy_scope = EXCLUDED.default_policy_scope,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- Acceptance check: the row must be discoverable by the eigen-widget-session
-- edge function lookup pattern (site_id = 'oracle-operator', status = 'active').
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.eigen_site_registry
    WHERE site_id = 'oracle-operator' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'oracle-operator registry row missing or not active after insert';
  END IF;
END $$;

-- =============================================================
-- ROLLBACK
-- =============================================================
-- DELETE FROM public.eigen_site_registry WHERE site_id = 'oracle-operator';
--
-- (No cascade concerns; eigen-widget-session simply rejects sessions for an
-- unknown site_id with HTTP 4xx, no orphan data created.)
