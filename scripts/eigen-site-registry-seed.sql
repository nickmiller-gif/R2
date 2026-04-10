-- One-time / repeatable seed for eigen_site_registry (all R2 ecosystem public sites).
-- Run in Supabase SQL Editor or: supabase db query --linked --file scripts/eigen-site-registry-seed.sql
--
-- Widget iframes are hosted on Cloudflare Pages; session POST Origin is the iframe host,
-- not the marketing domains. Adjust WIDGET_ORIGINS if you add/remove widget hosts.

-- Shared widget origins (browser Origin for eigen-widget-session from iframe)
-- Add http://localhost:5173 to the array for local widget dev if needed.

INSERT INTO public.eigen_site_registry (
  site_id,
  display_name,
  mode,
  origins,
  source_systems,
  default_policy_scope,
  status,
  metadata
) VALUES
  (
    'raysretreat',
    'Rays Retreat',
    'public',
    '["https://eigen-d3x.pages.dev","https://eigen.pages.dev"]'::jsonb,
    '["raysretreat"]'::jsonb,
    '["eigen_public"]'::jsonb,
    'active',
    '{"domains":["raysretreat.com","www.raysretreat.com","raysretreat.lovable.app"]}'::jsonb
  ),
  (
    'centralr2',
    'Central R2',
    'public',
    '["https://eigen-d3x.pages.dev","https://eigen.pages.dev"]'::jsonb,
    '["centralr2","centralr2-core"]'::jsonb,
    '["eigen_public"]'::jsonb,
    'active',
    '{"domains":["centralr2.com","www.centralr2.com"]}'::jsonb
  ),
  (
    'hptoolsdirect',
    'HP Tools Direct',
    'public',
    '["https://eigen-d3x.pages.dev","https://eigen.pages.dev"]'::jsonb,
    '["hptoolsdirect"]'::jsonb,
    '["eigen_public"]'::jsonb,
    'active',
    '{"domains":["hptoolsdirect.com","www.hptoolsdirect.com"]}'::jsonb
  ),
  (
    'r2ip',
    'R2 IP',
    'public',
    '["https://eigen-d3x.pages.dev","https://eigen.pages.dev"]'::jsonb,
    '["r2-ip","r2ip"]'::jsonb,
    '["eigen_public"]'::jsonb,
    'active',
    '{"domains":["r2-ip.com","www.r2-ip.com"]}'::jsonb
  ),
  (
    'r2chart',
    'R2 Chart',
    'public',
    '["https://eigen-d3x.pages.dev","https://eigen.pages.dev"]'::jsonb,
    '["r2chart"]'::jsonb,
    '["eigen_public"]'::jsonb,
    'active',
    '{"domains":["r2chart.com","www.r2chart.com"]}'::jsonb
  ),
  (
    'r2works',
    'R2 Works',
    'public',
    '["https://eigen-d3x.pages.dev","https://eigen.pages.dev"]'::jsonb,
    '["r2works"]'::jsonb,
    '["eigen_public"]'::jsonb,
    'active',
    '{"domains":["r2works.com","www.r2works.com"]}'::jsonb
  ),
  (
    'rsquaredip',
    'R Squared IP',
    'public',
    '["https://eigen-d3x.pages.dev","https://eigen.pages.dev"]'::jsonb,
    '["rsquaredip"]'::jsonb,
    '["eigen_public"]'::jsonb,
    'active',
    '{"domains":["rsquaredip.com","www.rsquaredip.com"]}'::jsonb
  ),
  (
    'health-supplement-tr',
    'Health Supplement TR',
    'mixed',
    '["https://health-supplement-tr.lovable.app","http://localhost:5173","http://localhost:8080"]'::jsonb,
    '["health-supplement-tr"]'::jsonb,
    '["eigen_public","eigenx"]'::jsonb,
    'active',
    '{"domains":["health-supplement-tr.lovable.app"]}'::jsonb
  ),
  (
    'project-darling',
    'Project Darling',
    'public',
    '["https://project-darling.lovable.app","http://localhost:5173","http://localhost:8080"]'::jsonb,
    '["project-darling"]'::jsonb,
    '["eigen_public"]'::jsonb,
    'active',
    '{"domains":["project-darling.lovable.app"]}'::jsonb
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
