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
  'smartplrx-trend-tracker',
  'TrendPulse (Smartplrx)',
  'mixed',
  '["https://smartplrx-trend-tracker.lovable.app", "http://localhost:5173", "http://localhost:8080"]'::jsonb,
  '["smartplrx"]'::jsonb,
  '["eigen_public", "eigenx"]'::jsonb,
  'active',
  '{"description":"Centralized supplement trend intelligence (sister surface to health-supplement-tr)"}'::jsonb
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
