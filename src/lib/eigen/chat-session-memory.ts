/**
 * Eigen chat — format session-scoped memory for LLM prompts (Deno-free).
 */

import { sanitizePromptFieldText } from './chat-entity-context.ts';

export const EIGEN_SESSION_MEMORY_INTRO =
  'Recent conversation context (this session; use for continuity, not as sole source of truth):';

const MAX_MEMORY_MESSAGE_CHARS = 600;
const MAX_MEMORY_RESPONSE_CHARS = 900;

export interface SessionMemoryTurn {
  message: string;
  response: string;
  timestamp?: string;
}

export function parseSessionMemoryValue(value: unknown): SessionMemoryTurn | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const message = typeof record.message === 'string' ? record.message.trim() : '';
  const response = typeof record.response === 'string' ? record.response.trim() : '';
  if (!message && !response) return null;
  const timestamp = typeof record.timestamp === 'string' ? record.timestamp.trim() : undefined;
  return {
    message: sanitizePromptFieldText(message, MAX_MEMORY_MESSAGE_CHARS),
    response: sanitizePromptFieldText(response, MAX_MEMORY_RESPONSE_CHARS),
    timestamp: timestamp || undefined,
  };
}

export function formatSessionMemoryForLlm(turn: SessionMemoryTurn | null): string {
  if (!turn) return '';
  const lines: string[] = [];
  if (turn.timestamp) lines.push(`Last turn at: ${turn.timestamp}`);
  if (turn.message) lines.push(`User: ${turn.message}`);
  if (turn.response) lines.push(`Assistant: ${turn.response}`);
  return lines.join('\n');
}

export function sessionMemoryKeyForChat(sessionId: string): string {
  return `chat:last_turn:${sessionId.trim()}`;
}
