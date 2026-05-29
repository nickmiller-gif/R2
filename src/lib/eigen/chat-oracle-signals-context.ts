/**
 * Eigen chat — format Oracle signals for entity-scoped LLM prompts (Deno-free).
 */

import { sanitizePromptFieldText } from './chat-entity-context.ts';

export const EIGEN_ORACLE_SIGNALS_INTRO =
  'Recent Oracle intelligence for scoped entities (high-confidence signals; prefer when discussing recent developments):';

export interface OracleSignalForPrompt {
  signalId: string;
  entityId: string;
  score: number;
  confidence: string;
  reasons: string[];
  tags: string[];
  scoredAt: string;
}

const MAX_REASONS = 3;
const MAX_REASON_CHARS = 280;
const MAX_SIGNALS = 6;

export function shouldIncludeOracleSignal(input: {
  score: number;
  confidence: string;
  minScore: number;
}): boolean {
  if (input.confidence === 'high') return true;
  if (input.confidence === 'low') return false;
  return input.score >= input.minScore;
}

export function formatOracleSignalsForLlm(signals: OracleSignalForPrompt[]): string {
  if (signals.length === 0) return '';
  const lines: string[] = [];
  for (const [index, signal] of signals.slice(0, MAX_SIGNALS).entries()) {
    lines.push(`Signal ${index + 1} (entity ${signal.entityId}, score ${signal.score})`);
    lines.push(`Confidence: ${signal.confidence}`);
    if (signal.scoredAt) lines.push(`Scored: ${signal.scoredAt}`);
    const reasons = signal.reasons
      .slice(0, MAX_REASONS)
      .map((r) => sanitizePromptFieldText(r, MAX_REASON_CHARS))
      .filter(Boolean);
    for (const reason of reasons) {
      lines.push(`- ${reason}`);
    }
    if (signal.tags.length > 0) {
      lines.push(`Tags: ${signal.tags.slice(0, 6).join(', ')}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}
