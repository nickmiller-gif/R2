-- Slice 5c: flip the Oracle published-content read-model views from
-- SECURITY DEFINER to SECURITY INVOKER, and add anon SELECT policies on the
-- underlying tables for exactly the rows those views expose.
--
-- Context (advisor lint 0010, four ERROR-level findings):
--   public.oracle_briefings_read_model
--   public.oracle_theme_map_read_model
--   public.oracle_feed_history_read_model
--   works.client_affiliations  (out of scope — not R2-owned)
--
-- DEFINER views run with the creator's (postgres/service_role) privileges,
-- which silently bypasses every underlying RLS policy. That makes the
-- `publication_state = 'published'` filter in each view the *only* boundary
-- standing between a shared Supabase anon key and every row of the
-- underlying tables.
--
-- Invoker semantics are the safer default: the view runs as the caller, so
-- the underlying RLS decides visibility. Since the views today serve
-- anonymous public-facing traffic (operator-workbench, raysretreat,
-- feed pages), we add anon SELECT policies on the three underlying tables
-- that mirror the view's WHERE clauses — anon can see published-and-dated
-- rows, nothing else. Authenticated reads keep their existing member /
-- operator policies.
--
-- Additive, idempotent. DROP POLICY IF EXISTS / ALTER VIEW SET
-- (security_invoker = true).

-- ───────────────────────────────────────────────────────────────────────
-- Anon SELECT policies: mirror the view WHERE clauses verbatim.
-- ───────────────────────────────────────────────────────────────────────

-- oracle_theses: feed_history_read_model, briefings_read_model,
-- theme_map_read_model all filter on publication_state='published'
-- AND published_at IS NOT NULL.
DROP POLICY IF EXISTS anon_select_published_oracle_theses ON public.oracle_theses;
CREATE POLICY anon_select_published_oracle_theses
  ON public.oracle_theses
  FOR SELECT TO anon
  USING (
    publication_state = 'published'::oracle_publication_state
    AND published_at IS NOT NULL
  );

-- oracle_signals: feed_history_read_model UNION branch filters the same way.
DROP POLICY IF EXISTS anon_select_published_oracle_signals ON public.oracle_signals;
CREATE POLICY anon_select_published_oracle_signals
  ON public.oracle_signals
  FOR SELECT TO anon
  USING (
    publication_state = 'published'::oracle_publication_state
    AND published_at IS NOT NULL
  );

-- oracle_outcomes: feed_history_read_model joins oracle_outcomes to
-- oracle_theses and filters the thesis side to published. An anon SELECT
-- on an outcome row is therefore allowed only when its linked thesis is
-- published.
DROP POLICY IF EXISTS anon_select_published_oracle_outcomes ON public.oracle_outcomes;
CREATE POLICY anon_select_published_oracle_outcomes
  ON public.oracle_outcomes
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.oracle_theses ot
      WHERE ot.id = oracle_outcomes.thesis_id
        AND ot.publication_state = 'published'::oracle_publication_state
        AND ot.published_at IS NOT NULL
    )
  );

-- ───────────────────────────────────────────────────────────────────────
-- Flip the three R2-owned read-model views from SECURITY DEFINER to
-- SECURITY INVOKER. (Postgres 15+ supports ALTER VIEW ... SET
-- (security_invoker); fallback to re-creating the view would require us
-- to know the full definition which is already captured in the earlier
-- oracle-publication-* migrations.)
-- ───────────────────────────────────────────────────────────────────────

ALTER VIEW public.oracle_briefings_read_model SET (security_invoker = true);
ALTER VIEW public.oracle_theme_map_read_model SET (security_invoker = true);
ALTER VIEW public.oracle_feed_history_read_model SET (security_invoker = true);

-- ───────────────────────────────────────────────────────────────────────
-- Also pin `public.entity_neighborhood` to a fixed search_path (advisor
-- lint 0011). Without it, a session `search_path = 'malicious_schema,
-- public'` could resolve `entity_relations` to an attacker-controlled
-- table and exfiltrate via the recursive CTE.
-- ───────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.entity_neighborhood(uuid, integer, numeric)
  SET search_path = public, pg_catalog;
