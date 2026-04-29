-- One-off backfill: set knowledge_chunks.meg_entity_id when exactly one MEG UUID
-- is listed in entity_ids and meg_entity_id is null, and that UUID exists as an active meg_entities row.
--
-- Review counts before commit:
--   SELECT count(*) FROM knowledge_chunks k
--   WHERE k.meg_entity_id IS NULL
--     AND jsonb_array_length(COALESCE(k.entity_ids, '[]'::jsonb)) = 1
--     AND EXISTS (
--       SELECT 1 FROM meg_entities e
--       WHERE e.id = (k.entity_ids->>0)::uuid AND e.status = 'active'
--     );

UPDATE knowledge_chunks k
SET
  meg_entity_id = (k.entity_ids->>0)::uuid,
  updated_at = now()
WHERE k.meg_entity_id IS NULL
  AND jsonb_typeof(k.entity_ids) = 'array'
  AND jsonb_array_length(COALESCE(k.entity_ids, '[]'::jsonb)) = 1
  AND EXISTS (
    SELECT 1
    FROM meg_entities e
    WHERE e.id = (k.entity_ids->>0)::uuid
      AND e.status = 'active'
  );
