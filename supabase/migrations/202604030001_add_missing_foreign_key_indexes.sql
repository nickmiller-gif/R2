-- Add indexes for all unindexed foreign keys flagged by Supabase advisors

-- charter_governance_entities.parent_id (self-referential FK)
CREATE INDEX IF NOT EXISTS idx_charter_governance_entities_parent_id
  ON public.charter_governance_entities (parent_id);

-- memory_entries.superseded_by (self-referential FK)
CREATE INDEX IF NOT EXISTS idx_memory_entries_superseded_by
  ON public.memory_entries (superseded_by);

-- oracle_signals.analysis_document_id (FK to documents)
CREATE INDEX IF NOT EXISTS idx_oracle_signals_analysis_document_id
  ON public.oracle_signals (analysis_document_id);

-- oracle_theses.duplicate_of_thesis_id (self-referential FK)
CREATE INDEX IF NOT EXISTS idx_oracle_theses_duplicate_of_thesis_id
  ON public.oracle_theses (duplicate_of_thesis_id);

-- oracle_theses.last_decision_by (FK to auth.users)
CREATE INDEX IF NOT EXISTS idx_oracle_theses_last_decision_by
  ON public.oracle_theses (last_decision_by);

-- oracle_theses.published_by (FK to auth.users)
CREATE INDEX IF NOT EXISTS idx_oracle_theses_published_by
  ON public.oracle_theses (published_by);

-- oracle_theses.superseded_by_thesis_id (self-referential FK)
CREATE INDEX IF NOT EXISTS idx_oracle_theses_superseded_by_thesis_id
  ON public.oracle_theses (superseded_by_thesis_id);
