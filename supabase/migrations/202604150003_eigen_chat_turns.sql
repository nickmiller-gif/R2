-- Additive: per-turn conversation history for multi-turn context and metrics.
-- Each session owns an ordered sequence of user + assistant turn records.
-- Replaces the lossy chat:last_turn memory pattern with a durable log.
-- Ordering is by created_at; turn_index is reserved for future explicit sequencing.

CREATE TABLE public.eigen_chat_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.eigen_chat_sessions(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  turn_index INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  retrieval_run_id UUID REFERENCES public.retrieval_runs(id) ON DELETE SET NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence JSONB,
  llm_provider TEXT,
  llm_model TEXT,
  llm_fallback_used BOOLEAN NOT NULL DEFAULT false,
  llm_critic_used BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eigen_chat_turns_session_id ON public.eigen_chat_turns(session_id);
CREATE INDEX idx_eigen_chat_turns_owner_id ON public.eigen_chat_turns(owner_id);
CREATE INDEX idx_eigen_chat_turns_session_created
  ON public.eigen_chat_turns(session_id, created_at DESC);

ALTER TABLE public.eigen_chat_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own chat turns"
  ON public.eigen_chat_turns FOR SELECT
  USING (
    ((SELECT auth.uid()) = owner_id)
    AND EXISTS (
      SELECT 1
      FROM public.eigen_chat_sessions
      WHERE public.eigen_chat_sessions.id = eigen_chat_turns.session_id
        AND public.eigen_chat_sessions.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert their own chat turns"
  ON public.eigen_chat_turns FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) = owner_id)
    AND EXISTS (
      SELECT 1
      FROM public.eigen_chat_sessions
      WHERE public.eigen_chat_sessions.id = eigen_chat_turns.session_id
        AND public.eigen_chat_sessions.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete their own chat turns"
  ON public.eigen_chat_turns FOR DELETE
  USING (
    ((SELECT auth.uid()) = owner_id)
    AND EXISTS (
      SELECT 1
      FROM public.eigen_chat_sessions
      WHERE public.eigen_chat_sessions.id = eigen_chat_turns.session_id
        AND public.eigen_chat_sessions.owner_id = (SELECT auth.uid())
    )
  );
