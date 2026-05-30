-- Hardening: memory_episodes RLS, bounds, and explicit role grants (E3).

ALTER TABLE public.memory_episodes
  ADD CONSTRAINT memory_episodes_topic_key_max CHECK (char_length(topic_key) <= 256),
  ADD CONSTRAINT memory_episodes_summary_max CHECK (char_length(summary) <= 3000),
  ADD CONSTRAINT memory_episodes_source_turn_ids_max CHECK (cardinality(source_turn_ids) <= 500),
  ADD CONSTRAINT memory_episodes_source_entry_ids_max CHECK (cardinality(source_entry_ids) <= 500),
  ADD CONSTRAINT memory_episodes_entity_ids_max CHECK (cardinality(entity_ids) <= 25);

DROP POLICY IF EXISTS "Users can read their own memory episodes" ON public.memory_episodes;

CREATE POLICY "Users can read own memory episodes"
  ON public.memory_episodes FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Service role manages memory episodes"
  ON public.memory_episodes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.memory_episodes FROM anon;
GRANT SELECT ON public.memory_episodes TO authenticated;
GRANT ALL ON public.memory_episodes TO service_role;
