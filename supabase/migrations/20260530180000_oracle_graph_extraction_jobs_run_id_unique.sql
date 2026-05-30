-- oracle-ws-pipeline enqueueGraphExtractionJob upserts with
-- onConflict: 'run_id', but oracle_graph_extraction_jobs had no unique
-- constraint/index on run_id, so the upsert failed ("no unique or exclusion
-- constraint matching the ON CONFLICT specification") and aborted the run.
-- Add the unique index the code already assumes (one extraction job per run).
CREATE UNIQUE INDEX IF NOT EXISTS oracle_graph_extraction_jobs_run_id_key
  ON public.oracle_graph_extraction_jobs (run_id);
