/**
 * Deterministic episode clustering and extractive summaries (E3).
 */

import { sanitizePromptFieldText } from './chat-entity-context.ts';

export const MIN_TURNS_FOR_EPISODE = 4;
export const MAX_TURNS_PER_EPISODE = 200;
export const MAX_PAIRS_IN_SUMMARY = 50;
export const EPISODE_SUMMARY_MAX_CHARS = 2400;
export const EPISODE_USER_TURN_MAX_CHARS = 280;
export const EPISODE_ASSISTANT_TURN_MAX_CHARS = 420;

export interface EpisodeTurnInput {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export { entityEpisodeTopicKey, sessionEpisodeTopicKey } from './memory-episode-keys.ts';

export function pairEpisodeTurns(turns: EpisodeTurnInput[]): EpisodeTurnInput[][] {
  const sorted = [...turns].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const pairs: EpisodeTurnInput[][] = [];
  let current: EpisodeTurnInput[] = [];

  for (const turn of sorted) {
    if (turn.role === 'user') {
      if (current.length > 0) pairs.push(current);
      current = [turn];
      continue;
    }
    if (current.length === 1 && current[0]?.role === 'user') {
      current.push(turn);
      pairs.push(current);
      current = [];
    }
  }

  return pairs;
}

export function buildEpisodeSummaryFromTurns(turns: EpisodeTurnInput[]): string {
  const cappedTurns = turns.slice(0, MAX_TURNS_PER_EPISODE);
  const pairs = pairEpisodeTurns(cappedTurns).slice(0, MAX_PAIRS_IN_SUMMARY);
  if (pairs.length === 0) return '';

  const lines: string[] = [];
  for (const pair of pairs) {
    const user = pair.find((turn) => turn.role === 'user');
    const assistant = pair.find((turn) => turn.role === 'assistant');
    if (!user) continue;
    const userText = sanitizePromptFieldText(user.content, EPISODE_USER_TURN_MAX_CHARS);
    const assistantText = assistant
      ? sanitizePromptFieldText(assistant.content, EPISODE_ASSISTANT_TURN_MAX_CHARS)
      : '';
    lines.push(`User: ${userText}`);
    if (assistantText) lines.push(`Assistant: ${assistantText}`);
  }

  const joined = lines.join('\n');
  if (joined.length <= EPISODE_SUMMARY_MAX_CHARS) return joined;
  return joined.slice(0, EPISODE_SUMMARY_MAX_CHARS - 3) + '...';
}

export function episodeWindowFromTurns(turns: EpisodeTurnInput[]): {
  windowStart: string;
  windowEnd: string;
} | null {
  if (turns.length === 0) return null;
  const sorted = [...turns].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return {
    windowStart: sorted[0]!.createdAt,
    windowEnd: sorted[sorted.length - 1]!.createdAt,
  };
}

export function shouldConsolidateSessionTurns(turnCount: number): boolean {
  return turnCount >= MIN_TURNS_FOR_EPISODE;
}
