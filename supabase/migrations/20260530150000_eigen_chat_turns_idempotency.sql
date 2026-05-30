-- eigen-chat turn-pair idempotency: dedupe retries that reuse x-idempotency-key.

ALTER TABLE public.eigen_chat_turns
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_eigen_chat_turns_owner_idempotency
  ON public.eigen_chat_turns (owner_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.eigen_chat_turns.idempotency_key IS
  'Caller-supplied x-idempotency-key on the assistant row; dedupes turn-pair inserts on retry.';
