CREATE TABLE IF NOT EXISTS public.conversation_turn (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('public', 'eigenx')),
  user_id UUID,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  retrieval_run_id UUID REFERENCES public.retrieval_runs(id) ON DELETE SET NULL,
  effective_policy_scope TEXT[] NOT NULL DEFAULT '{}'::text[],
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence JSONB,
  retrieval_plan JSONB,
  latency_ms INTEGER,
  feedback_value SMALLINT CHECK (feedback_value IN (-1, 0, 1)),
  feedback_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_turn_created_at
  ON public.conversation_turn(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_turn_site
  ON public.conversation_turn(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_turn_mode
  ON public.conversation_turn(mode, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_turn_retrieval_run
  ON public.conversation_turn(retrieval_run_id);

ALTER TABLE public.conversation_turn ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversation_turn'
      AND policyname = 'Service role manages conversation_turn'
  ) THEN
    CREATE POLICY "Service role manages conversation_turn"
      ON public.conversation_turn
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.conversation_turn_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turn_id UUID NOT NULL REFERENCES public.conversation_turn(id) ON DELETE CASCADE,
  value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_turn_feedback_turn
  ON public.conversation_turn_feedback(turn_id, created_at DESC);

ALTER TABLE public.conversation_turn_feedback ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversation_turn_feedback'
      AND policyname = 'Service role manages conversation_turn_feedback'
  ) THEN
    CREATE POLICY "Service role manages conversation_turn_feedback"
      ON public.conversation_turn_feedback
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END
$$;
