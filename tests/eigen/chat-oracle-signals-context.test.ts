import { describe, expect, it } from 'vitest';
import {
  formatOracleSignalsForLlm,
  shouldIncludeOracleSignal,
} from '../../src/lib/eigen/chat-oracle-signals-context.ts';

const ENTITY_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('chat-oracle-signals-context', () => {
  it('includes high confidence signals regardless of score', () => {
    expect(shouldIncludeOracleSignal({ score: 40, confidence: 'high', minScore: 65 })).toBe(true);
  });

  it('filters low confidence signals', () => {
    expect(shouldIncludeOracleSignal({ score: 90, confidence: 'low', minScore: 65 })).toBe(false);
  });

  it('formats signal reasons for the llm', () => {
    const block = formatOracleSignalsForLlm([
      {
        signalId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        entityId: ENTITY_ID,
        score: 82,
        confidence: 'high',
        reasons: ['Acme announced leadership change'],
        tags: ['workforce'],
        scoredAt: '2026-05-29T12:00:00.000Z',
      },
    ]);
    expect(block).toContain('Signal 1');
    expect(block).toContain('leadership change');
  });
});
