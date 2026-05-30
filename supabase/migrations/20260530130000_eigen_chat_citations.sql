-- E4: Persistent citation IDs linking chat turns to retrieved chunks (operator audit).
-- Additive; citations survive in a queryable table beyond session-scoped JSONB on turns.

CREATE TABLE IF NOT EXISTS public.eigen_chat_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_turn_id UUID NOT NULL REFERENCES public.eigen_chat_turns(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  chunk_id UUID,
  rank_index INTEGER NOT NULL DEFAULT 0 CHECK (rank_index >= 0),
  source TEXT NOT NULL DEFAULT 'unknown',
  section TEXT,
  relevance NUMERIC(8, 4) NOT NULL DEFAULT 0,
  authority_tier TEXT NOT NULL DEFAULT 'corpus',
  evidence_tier TEXT NOT NULL DEFAULT 'D' CHECK (evidence_tier IN ('A', 'B', 'C', 'D')),
  policy_decision_id UUID REFERENCES public.eigen_policy_decisions(id) ON DELETE SET NULL,
  retrieval_run_id UUID REFERENCES public.retrieval_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eigen_chat_citations_turn_id
  ON public.eigen_chat_citations (chat_turn_id, rank_index);

CREATE INDEX IF NOT EXISTS idx_eigen_chat_citations_owner_created
  ON public.eigen_chat_citations (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_eigen_chat_citations_chunk_id
  ON public.eigen_chat_citations (chunk_id)
  WHERE chunk_id IS NOT NULL;

ALTER TABLE public.eigen_chat_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own chat citations"
  ON public.eigen_chat_citations FOR SELECT
  USING (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1
      FROM public.eigen_chat_turns t
      WHERE t.id = eigen_chat_citations.chat_turn_id
        AND t.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS eigen_chat_citations_service_write ON public.eigen_chat_citations;
CREATE POLICY eigen_chat_citations_service_write
  ON public.eigen_chat_citations FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS eigen_chat_citations_service_read ON public.eigen_chat_citations;
CREATE POLICY eigen_chat_citations_service_read
  ON public.eigen_chat_citations FOR SELECT TO service_role
  USING (true);

COMMENT ON TABLE public.eigen_chat_citations IS
  'Canonical citation rows shown to users in Eigen chat; links assistant turns to knowledge_chunks and optional policy decisions.';
