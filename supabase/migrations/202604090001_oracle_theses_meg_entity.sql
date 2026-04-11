-- Oracle theses: add optional MEG entity reference.
-- Allows direct querying of theses by canonical identity ("all theses about entity X")
-- without routing through the asset registry indirection.
-- Nullable because existing theses and theses about abstract topics have no MEG subject.

ALTER TABLE oracle_theses
  ADD COLUMN meg_entity_id UUID REFERENCES meg_entities (id) ON DELETE SET NULL;

CREATE INDEX idx_oracle_theses_meg_entity
  ON oracle_theses (meg_entity_id)
  WHERE meg_entity_id IS NOT NULL;

COMMENT ON COLUMN oracle_theses.meg_entity_id IS
  'Optional FK to MEG canonical identity — the real-world subject this thesis is about.';
