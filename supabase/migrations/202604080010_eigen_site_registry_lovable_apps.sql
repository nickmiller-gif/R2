-- Register Lovable frontend apps in the Eigen site registry.
-- Mode: 'mixed' — public chat for anonymous visitors, eigenx for signed-in users.
-- Each app's .lovable.app domain + localhost for development are allowed origins.

INSERT INTO public.eigen_site_registry
  (site_id, display_name, mode, origins, source_systems, default_policy_scope, status)
VALUES
  (
    'r2app',
    'R2 App',
    'mixed',
    '["https://r2app.lovable.app", "http://localhost:5173", "http://localhost:8080"]'::jsonb,
    '["r2app"]'::jsonb,
    '["eigen_public", "eigenx"]'::jsonb,
    'active'
  ),
  (
    'hpseller',
    'HP Seller',
    'mixed',
    '["https://hpseller.lovable.app", "http://localhost:5173", "http://localhost:8080"]'::jsonb,
    '["hpseller"]'::jsonb,
    '["eigen_public", "eigenx"]'::jsonb,
    'active'
  ),
  (
    'ip-insights-hub',
    'IP Insights Hub',
    'mixed',
    '["https://ip-insights-hub.lovable.app", "http://localhost:5173", "http://localhost:8080"]'::jsonb,
    '["ip-insights-hub"]'::jsonb,
    '["eigen_public", "eigenx"]'::jsonb,
    'active'
  ),
  (
    'centralr2-core',
    'Central R2 Core',
    'mixed',
    '["https://centralr2-core.lovable.app", "http://localhost:5173", "http://localhost:8080"]'::jsonb,
    '["centralr2-core"]'::jsonb,
    '["eigen_public", "eigenx"]'::jsonb,
    'active'
  )
ON CONFLICT (site_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  mode = EXCLUDED.mode,
  origins = EXCLUDED.origins,
  source_systems = EXCLUDED.source_systems,
  default_policy_scope = EXCLUDED.default_policy_scope,
  status = EXCLUDED.status,
  updated_at = now();
