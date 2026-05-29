import { describe, expect, it } from 'vitest';
import {
  resolveEigenRetrievalQualityFlags,
  readOracleSignalChatMinScore,
} from '../../src/lib/eigen/retrieve-feature-flags.ts';

describe('retrieve-feature-flags top tier', () => {
  it('enables multi-query and rerank when top tier is on', () => {
    const flags = resolveEigenRetrievalQualityFlags({
      topTier: 'true',
      multiQuery: 'false',
      rerank: 'false',
    });
    expect(flags.topTier).toBe(true);
    expect(flags.multiQuery).toBe(true);
    expect(flags.rerank).toBe(true);
  });

  it('honors individual flags when top tier is off', () => {
    const flags = resolveEigenRetrievalQualityFlags({
      topTier: 'false',
      multiQuery: 'true',
      rerank: 'false',
    });
    expect(flags.multiQuery).toBe(true);
    expect(flags.rerank).toBe(false);
  });

  it('clamps oracle signal min score', () => {
    expect(readOracleSignalChatMinScore('80')).toBe(80);
    expect(readOracleSignalChatMinScore('bad')).toBe(65);
    expect(readOracleSignalChatMinScore('150')).toBe(100);
  });
});
