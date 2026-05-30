-- E4 hardening: one citation row per (turn, rank) so retries cannot duplicate audit rows.
-- Service role needs DELETE for replace-before-insert idempotency in edge functions.

CREATE UNIQUE INDEX IF NOT EXISTS idx_eigen_chat_citations_turn_rank_unique
  ON public.eigen_chat_citations (chat_turn_id, rank_index);

DROP POLICY IF EXISTS eigen_chat_citations_service_delete ON public.eigen_chat_citations;
CREATE POLICY eigen_chat_citations_service_delete
  ON public.eigen_chat_citations FOR DELETE TO service_role
  USING (true);
