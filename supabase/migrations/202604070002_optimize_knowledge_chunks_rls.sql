-- Optimize knowledge_chunks RLS policies:
-- 1. Wrap auth.uid() in (SELECT ...) for initPlan caching (1700x speedup at scale)
-- 2. Add service_role write policy for embedding workers

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read knowledge chunks for their documents" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Users can insert knowledge chunks for their documents" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Users can update knowledge chunks for their documents" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Users can delete knowledge chunks for their documents" ON public.knowledge_chunks;

-- Recreate with (SELECT auth.uid()) initPlan optimization
CREATE POLICY knowledge_chunks_select ON public.knowledge_chunks
  FOR SELECT TO authenticated
  USING (
    document_id IN (
      SELECT id FROM public.documents WHERE owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY knowledge_chunks_insert ON public.knowledge_chunks
  FOR INSERT TO authenticated
  WITH CHECK (
    document_id IN (
      SELECT id FROM public.documents WHERE owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY knowledge_chunks_update ON public.knowledge_chunks
  FOR UPDATE TO authenticated
  USING (
    document_id IN (
      SELECT id FROM public.documents WHERE owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY knowledge_chunks_delete ON public.knowledge_chunks
  FOR DELETE TO authenticated
  USING (
    document_id IN (
      SELECT id FROM public.documents WHERE owner_id = (SELECT auth.uid())
    )
  );

-- Service role: full access for embedding workers and ingestion pipelines
CREATE POLICY knowledge_chunks_service_role ON public.knowledge_chunks
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
