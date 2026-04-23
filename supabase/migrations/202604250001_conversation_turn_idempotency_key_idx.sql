-- Fast deduplication lookup for conversation_turn by idempotency_key alone.
-- The scope-composite index (migration 202604180004) covers deduplication
-- within a (mode, site_id, user_id) partition. This companion partial index
-- lets the idempotency-key existence check in conversation-turn.ts (the
-- 23505-conflict recovery path) resolve in O(log n) without a full-scope scan.

CREATE UNIQUE INDEX IF NOT EXISTS conversation_turn_idempotency_key_idx
  ON public.conversation_turn (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
