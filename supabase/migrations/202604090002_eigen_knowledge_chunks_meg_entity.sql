-- Eigen knowledge chunks: MEG identity hardening.
--
-- 1. GIN index on entity_ids JSONB array for containment queries (@>).
--    Enables "find all chunks mentioning MEG entity X" via:
--      WHERE entity_ids @> '["<meg-entity-uuid>"]'::jsonb
--
-- 2. Optional meg_entity_id FK for the primary subject entity.
--    entity_ids remains for multi-entity tagging (mentions);
--    meg_entity_id singles out the canonical subject.

CREATE INDEX idx_knowledge_chunks_entity_ids_gin
  ON knowledge_chunks USING GIN (entity_ids jsonb_path_ops);

ALTER TABLE knowledge_chunks
  ADD COLUMN meg_entity_id UUID REFERENCES meg_entities (id) ON DELETE SET NULL;

CREATE INDEX idx_knowledge_chunks_meg_entity
  ON knowledge_chunks (meg_entity_id)
  WHERE meg_entity_id IS NOT NULL;

COMMENT ON COLUMN knowledge_chunks.meg_entity_id IS
  'Optional FK to MEG canonical identity — the primary subject of this chunk.';
COMMENT ON COLUMN knowledge_chunks.entity_ids IS
  'JSONB array of MEG entity UUIDs mentioned in this chunk (tags, not primary subject).';
