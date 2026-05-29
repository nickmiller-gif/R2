/**
 * Eigen chat — format consolidated memory episodes for LLM prompts.
 */

import { sanitizePromptFieldText } from './chat-entity-context.ts';

export const EIGEN_MEMORY_EPISODE_INTRO =
  'Consolidated conversation memory (summarized from recent turns; use for continuity, not as sole source of truth):';

const MAX_EPISODE_SUMMARY_CHARS = 2400;

export interface MemoryEpisodeForPrompt {
  summary: string;
  turnCount: number;
  windowEnd?: string;
  topicKey?: string;
}

export function formatMemoryEpisodeForLlm(episode: MemoryEpisodeForPrompt | null): string {
  if (!episode?.summary?.trim()) return '';
  const lines: string[] = [];
  if (episode.windowEnd) lines.push(`Last consolidated at: ${episode.windowEnd}`);
  if (episode.turnCount > 0) lines.push(`Turns summarized: ${episode.turnCount}`);
  lines.push(sanitizePromptFieldText(episode.summary, MAX_EPISODE_SUMMARY_CHARS));
  return lines.join('\n');
}

export type ChatMemoryRecallSource = 'episode' | 'last_turn' | 'none';

export interface ChatMemoryRecallResult {
  block: string;
  source: ChatMemoryRecallSource;
  intro: string;
}
