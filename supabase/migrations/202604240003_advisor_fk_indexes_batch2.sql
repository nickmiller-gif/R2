-- Follow-up covering indexes for foreign keys that the Supabase advisor
-- `unindexed_foreign_keys` lint flagged on public-schema R2 tables after
-- 202604220001 shipped. Each FK join otherwise forces a seq scan on the
-- referenced table during DELETE / UPDATE cascade checks.
--
-- Additive only. `IF NOT EXISTS` so re-running is a no-op.

CREATE INDEX IF NOT EXISTS idx_oracle_graph_extraction_jobs_run_id
  ON public.oracle_graph_extraction_jobs (run_id);

CREATE INDEX IF NOT EXISTS idx_oracle_publication_events_decided_by
  ON public.oracle_publication_events (decided_by);

CREATE INDEX IF NOT EXISTS idx_oracle_signals_published_by
  ON public.oracle_signals (published_by);
