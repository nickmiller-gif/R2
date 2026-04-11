-- Allow authenticated clients (PostgREST / Supabase JS) to read Oracle published read models.
-- Views honor underlying RLS on oracle_theses / oracle_signals / oracle_outcomes.

GRANT SELECT ON public.oracle_briefings_read_model TO authenticated;
GRANT SELECT ON public.oracle_theme_map_read_model TO authenticated;
GRANT SELECT ON public.oracle_feed_history_read_model TO authenticated;
