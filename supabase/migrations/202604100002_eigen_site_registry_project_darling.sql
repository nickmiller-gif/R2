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
  'project-darling',
  'Project Darling',
  'public',
  '["https://project-darling.lovable.app", "http://localhost:5173", "http://localhost:8080"]'::jsonb,
  '["project-darling"]'::jsonb,
  '["eigen_public"]'::jsonb,
  'active',
  '{"description":"Project Darling UI-only site; currently onboarded for widget + file/sitemap ingestion"}'::jsonb
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
