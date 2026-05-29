/**
 * Oracle signal → Eigen memory promotion (slice X2) — pure logic for Vitest + edge.
 */

import { DEFAULT_ORACLE_SIGNAL_CHAT_MIN_SCORE } from '../../lib/eigen/retrieve-feature-flags.ts';

export interface OracleSignalPromotionInput {
  signalId: string;
  entityId: string;
  score: number;
  confidence: string;
  reasons: string[];
  tags: string[];
  scoredAt: string;
}

export function oracleEntitySignalMemoryKey(entityId: string, signalId: string): string {
  return `oracle:entity:${entityId.trim()}:signal:${signalId.trim()}`;
}

export function shouldPromoteOracleSignalToMemory(
  input: { score: number; confidence: string },
  minScore = DEFAULT_ORACLE_SIGNAL_CHAT_MIN_SCORE,
): boolean {
  if (input.confidence === 'high') return true;
  if (input.confidence === 'low') return false;
  return input.score >= minScore;
}

export function buildOracleSignalMemoryValue(
  input: OracleSignalPromotionInput,
): Record<string, unknown> {
  return {
    signal_id: input.signalId,
    meg_entity_id: input.entityId,
    score: input.score,
    confidence: input.confidence,
    reasons: input.reasons.slice(0, 5),
    tags: input.tags.slice(0, 12),
    scored_at: input.scoredAt,
    source: 'oracle_signal_promotion',
  };
}
