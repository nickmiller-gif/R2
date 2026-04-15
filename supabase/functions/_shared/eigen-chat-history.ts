/**
 * DB-backed conversation history helpers for eigen-chat.
 * Loads recent turns for multi-turn context and persists turn pairs after each response.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ConversationTurn } from '../../../src/lib/eigen/chat-history-utils.ts';

/** Maximum history rows fetched per request (user + assistant = 2 rows per exchange). */
const DEFAULT_MAX_HISTORY_ROWS = 10;

interface TurnRow {
  role: string;
  content: string;
  created_at: string;
}

/**
 * Loads the most recent turns for a session, returned in chronological order.
 * Silently returns [] on error so history failures never block the response.
 */
export async function loadRecentTurns(
  client: SupabaseClient,
  sessionId: string,
  userId: string,
  maxRows: number = DEFAULT_MAX_HISTORY_ROWS,
): Promise<ConversationTurn[]> {
  // Clamp to even number so we always fetch complete user/assistant pairs.
  const rawLimit = Math.max(2, Math.min(maxRows, 30));
  const limit = rawLimit % 2 === 0 ? rawLimit : rawLimit + 1;
  const { data, error } = await client
    .from('eigen_chat_turns')
    .select('role,content,created_at')
    .eq('session_id', sessionId)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  // Rows arrived newest-first; reverse for chronological order.
  let rows = (data as TurnRow[]).slice().reverse();

  // Drop a leading assistant turn so history always starts on a user turn.
  if (rows.length > 0 && rows[0]!.role === 'assistant') {
    rows = rows.slice(1);
  }

  // Ensure even count so we always have complete user/assistant pairs.
  if (rows.length % 2 !== 0) {
    rows = rows.slice(0, -1);
  }

  return rows.map((row) => ({
    role: row.role as 'user' | 'assistant',
    content: row.content,
  }));
}

export interface PersistTurnPairInput {
  sessionId: string;
  ownerId: string;
  userMessage: string;
  assistantMessage: string;
  retrievalRunId: string | null;
  citations: unknown[];
  confidence: unknown | null;
  llmProvider: string | null;
  llmModel: string | null;
  llmFallbackUsed: boolean;
  llmCriticUsed: boolean;
  latencyMs: number;
}

/**
 * Inserts a user + assistant turn pair into `eigen_chat_turns`.
 * The DB assigns `created_at` via its `now()` default; `turn_index`
 * (0 = user, 1 = assistant) provides a deterministic tie-breaker for
 * ordering within the same pair.
 *
 * Returns `{ ok: false }` on DB error without throwing so callers can
 * log and continue (the primary response has already been sent).
 */
export async function persistTurnPair(
  client: SupabaseClient,
  input: PersistTurnPairInput,
): Promise<{ ok: boolean; error?: string }> {
  // Let the DB assign created_at via its now() default.
  // Use turn_index (0 = user, 1 = assistant) as a deterministic tie-breaker
  // for ordering within the same pair, avoiding client-clock drift issues.
  const { error } = await client.from('eigen_chat_turns').insert([
    {
      session_id: input.sessionId,
      owner_id: input.ownerId,
      role: 'user',
      turn_index: 0,
      content: input.userMessage,
      retrieval_run_id: null,
      citations: [],
      confidence: null,
      llm_provider: null,
      llm_model: null,
      llm_fallback_used: false,
      llm_critic_used: false,
      latency_ms: null,
    },
    {
      session_id: input.sessionId,
      owner_id: input.ownerId,
      role: 'assistant',
      turn_index: 1,
      content: input.assistantMessage,
      retrieval_run_id: input.retrievalRunId,
      citations: input.citations,
      confidence: input.confidence,
      llm_provider: input.llmProvider,
      llm_model: input.llmModel,
      llm_fallback_used: input.llmFallbackUsed,
      llm_critic_used: input.llmCriticUsed,
      latency_ms: input.latencyMs,
    },
  ]);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
