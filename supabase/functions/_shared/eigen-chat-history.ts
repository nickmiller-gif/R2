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
  const limit = Math.max(2, Math.min(maxRows, 30));
  const { data, error } = await client
    .from('eigen_chat_turns')
    .select('role,content,created_at')
    .eq('session_id', sessionId)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  // Rows arrived newest-first; reverse for chronological order.
  const rows = (data as TurnRow[]).slice().reverse();
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
 * The assistant turn is timestamped 1 ms after the user turn to guarantee
 * stable created_at ordering within the same transaction.
 *
 * Returns `{ ok: false }` on DB error without throwing so callers can
 * log and continue (the primary response has already been sent).
 */
export async function persistTurnPair(
  client: SupabaseClient,
  input: PersistTurnPairInput,
): Promise<{ ok: boolean; error?: string }> {
  const userTurnAt = new Date().toISOString();
  const asstTurnAt = new Date(Date.now() + 1).toISOString();

  const { error } = await client.from('eigen_chat_turns').insert([
    {
      session_id: input.sessionId,
      owner_id: input.ownerId,
      role: 'user',
      content: input.userMessage,
      retrieval_run_id: null,
      citations: [],
      confidence: null,
      llm_provider: null,
      llm_model: null,
      llm_fallback_used: false,
      llm_critic_used: false,
      latency_ms: null,
      created_at: userTurnAt,
    },
    {
      session_id: input.sessionId,
      owner_id: input.ownerId,
      role: 'assistant',
      content: input.assistantMessage,
      retrieval_run_id: input.retrievalRunId,
      citations: input.citations,
      confidence: input.confidence,
      llm_provider: input.llmProvider,
      llm_model: input.llmModel,
      llm_fallback_used: input.llmFallbackUsed,
      llm_critic_used: input.llmCriticUsed,
      latency_ms: input.latencyMs,
      created_at: asstTurnAt,
    },
  ]);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
