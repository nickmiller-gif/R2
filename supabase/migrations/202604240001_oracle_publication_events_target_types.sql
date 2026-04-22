-- Broaden oracle_publication_events for operator workflow audit rows
-- (versioned rescore, thesis supersede) while keeping additive posture.

ALTER TABLE public.oracle_publication_events
  DROP CONSTRAINT IF EXISTS oracle_publication_events_target_type_check;

ALTER TABLE public.oracle_publication_events
  ADD CONSTRAINT oracle_publication_events_target_type_check
  CHECK (target_type IN ('thesis', 'signal', 'thesis_supersession', 'signal_rescore'));

-- Allow non-publication-state workflow labels in audit rows (superseded, new_version, etc.).
ALTER TABLE public.oracle_publication_events
  ALTER COLUMN from_state TYPE text USING (
    CASE WHEN from_state IS NULL THEN NULL ELSE from_state::text END);

ALTER TABLE public.oracle_publication_events
  ALTER COLUMN to_state TYPE text USING (to_state::text);
