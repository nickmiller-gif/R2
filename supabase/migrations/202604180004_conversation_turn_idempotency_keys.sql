ALTER TABLE public.conversation_turn
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_turn_scope_idempotency_key
  ON public.conversation_turn(
    mode,
    coalesce(site_id, ''),
    coalesce(user_id::text, ''),
    idempotency_key
  )
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.conversation_turn_feedback
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_turn_feedback_turn_idempotency_key
  ON public.conversation_turn_feedback(turn_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
