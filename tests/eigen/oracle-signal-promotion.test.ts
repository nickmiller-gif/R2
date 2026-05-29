import { describe, expect, it } from 'vitest';
import {
  buildOracleSignalMemoryValue,
  oracleEntitySignalMemoryKey,
  shouldPromoteOracleSignalToMemory,
} from '../../src/services/eigen/oracle-signal-promotion.service.ts';

const ENTITY_ID = '550e8400-e29b-41d4-a716-446655440000';
const SIGNAL_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('oracle-signal-promotion', () => {
  it('builds stable memory keys per entity and signal', () => {
    expect(oracleEntitySignalMemoryKey(ENTITY_ID, SIGNAL_ID)).toBe(
      `oracle:entity:${ENTITY_ID}:signal:${SIGNAL_ID}`,
    );
  });

  it('promotes high-confidence signals', () => {
    expect(shouldPromoteOracleSignalToMemory({ score: 50, confidence: 'high' })).toBe(true);
  });

  it('builds memory value payload', () => {
    const value = buildOracleSignalMemoryValue({
      signalId: SIGNAL_ID,
      entityId: ENTITY_ID,
      score: 78,
      confidence: 'medium',
      reasons: ['Market shift detected'],
      tags: ['macro'],
      scoredAt: '2026-05-29T12:00:00.000Z',
    });
    expect(value.signal_id).toBe(SIGNAL_ID);
    expect(value.meg_entity_id).toBe(ENTITY_ID);
  });
});
