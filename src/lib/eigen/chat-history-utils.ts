/**
 * Pure helpers for chat conversation history — no Deno APIs, no HTTP calls.
 * Importable in both Node (tests) and Deno (edge functions).
 */

/** A single turn in a multi-turn conversation. */
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Builds the messages array for the LLM by prepending history turns before
 * the current user content. History turns carry only Q/A text (no retrieved
 * context) to avoid token bloat. The current turn includes its retrieved context.
 */
export function buildConversationMessages(
  history: ConversationTurn[],
  currentUserContent: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return [
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: 'user' as const, content: currentUserContent },
  ];
}

/**
 * Formats prior turns into a compact prior-conversation preamble.
 * Truncates long turns to stay within the approximate token hint.
 * Returns an empty string when history is empty.
 */
export function formatHistoryForContext(
  turns: ConversationTurn[],
  maxCharsPerTurn = 400,
): string {
  if (turns.length === 0) return '';

  const pairs: string[] = [];
  for (let i = 0; i + 1 < turns.length; i += 2) {
    const user = turns[i]!;
    const assistant = turns[i + 1]!;
    const userText =
      user.content.length > maxCharsPerTurn
        ? `${user.content.slice(0, maxCharsPerTurn)}…`
        : user.content;
    const asstText =
      assistant.content.length > maxCharsPerTurn
        ? `${assistant.content.slice(0, maxCharsPerTurn)}…`
        : assistant.content;
    pairs.push(`User: ${userText}\nAssistant: ${asstText}`);
  }

  if (pairs.length === 0) return '';
  return `Prior conversation:\n${pairs.join('\n\n')}`;
}

/**
 * Selects up to `maxTurns` of the most recent history entries, starts on a
 * user turn, and keeps an even number of turns so the slice ends on an
 * assistant (valid user/assistant pairs for Anthropic-style APIs).
 */
export function trimHistoryToBudget(
  turns: ConversationTurn[],
  maxTurns: number,
): ConversationTurn[] {
  const limit = Math.max(2, maxTurns);
  if (turns.length <= limit) return turns;
  let start = turns.length - limit;
  if (start < turns.length && turns[start]?.role === 'assistant') start += 1;
  const sliced = turns.slice(start);
  if (sliced.length % 2 !== 0) return sliced.slice(0, -1);
  return sliced;
}
