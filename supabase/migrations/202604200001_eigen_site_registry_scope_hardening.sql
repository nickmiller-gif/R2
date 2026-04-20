-- Eigen Site Registry: scope hardening + stale origin scrub
--
-- Context (Widget Audit 2026-04-20, finding P0):
--   Public (unauthenticated) widget sessions were able to retrieve chunks
--   tagged `eigenx` because several mixed-mode registry rows carried
--   `['eigen_public','eigenx']` in `default_policy_scope`. The session
--   endpoint forwarded that scope into the widget JWT, so anonymous
--   visitors were effectively granted private scope.
--
-- Fix is layered:
--   1. Code filter in eigen-widget-session strips `eigenx` whenever the
--      issued token's mode is `public` (primary defense).
--   2. Belt-and-suspenders filter in eigen-widget-chat repeats the strip
--      on every turn (defense in depth).
--   3. This migration scrubs existing drift from the registry and adds
--      a CHECK constraint so the drift cannot be re-introduced via the
--      dashboard, seed migration, or a future /EIGEN_WIDGET_SITE_MAP
--      change that somehow back-propagates into the table.
--
-- Also drops stale operator-workbench origins (r2works.com /
-- www.r2works.com) that are no longer served by the React SPA. Apex
-- r2works.com 404s and www.r2works.com serves a different property;
-- keeping them in the allowlist is latent surface area if either
-- domain is ever re-pointed.

BEGIN;

-- 1. Scrub drift: remove 'eigenx' from default_policy_scope on every row
--    whose mode is NOT 'eigenx'. We preserve 'eigenx' on mode='eigenx'
--    rows (those are authenticated-only and required to grant private
--    scope). If the strip produces an empty array, fall back to the
--    canonical public tag so retrieval still has a scope to filter by.
UPDATE public.eigen_site_registry
SET default_policy_scope = CASE
      WHEN jsonb_array_length(
             COALESCE(
               (SELECT jsonb_agg(tag)
                  FROM jsonb_array_elements_text(default_policy_scope) AS tag
                  WHERE tag <> 'eigenx'),
               '[]'::jsonb
             )
           ) = 0
        THEN '["eigen_public"]'::jsonb
      ELSE
        COALESCE(
          (SELECT jsonb_agg(tag)
             FROM jsonb_array_elements_text(default_policy_scope) AS tag
             WHERE tag <> 'eigenx'),
          '[]'::jsonb
        )
    END,
    updated_at = now()
WHERE mode <> 'eigenx'
  AND default_policy_scope ? 'eigenx';

-- 2. Drop stale r2works.com / www.r2works.com origins from
--    operator-workbench. The SPA deploys to operator-workbench.pages.dev
--    (and the preview deploy hostname); the apex/www r2works.com
--    domains serve different properties today.
UPDATE public.eigen_site_registry
SET origins = COALESCE(
      (SELECT jsonb_agg(origin)
         FROM jsonb_array_elements_text(origins) AS origin
         WHERE origin NOT IN ('https://r2works.com', 'https://www.r2works.com')),
      '[]'::jsonb
    ),
    updated_at = now()
WHERE site_id = 'operator-workbench'
  AND (origins ? 'https://r2works.com' OR origins ? 'https://www.r2works.com');

-- 3. CHECK constraint: forbid 'eigenx' in default_policy_scope unless
--    the row is mode='eigenx'. Uses a scalar subquery against
--    jsonb_array_elements_text; marked NOT VALID first so the migration
--    succeeds even if (defensively) a row slipped the UPDATE above,
--    then VALIDATE as a separate statement so we fail loudly if scrub
--    missed a row.
ALTER TABLE public.eigen_site_registry
  DROP CONSTRAINT IF EXISTS eigen_site_registry_scope_mode_consistency;

ALTER TABLE public.eigen_site_registry
  ADD CONSTRAINT eigen_site_registry_scope_mode_consistency
  CHECK (
    mode = 'eigenx'
    OR NOT (default_policy_scope ? 'eigenx')
  )
  NOT VALID;

ALTER TABLE public.eigen_site_registry
  VALIDATE CONSTRAINT eigen_site_registry_scope_mode_consistency;

COMMIT;
