import { describe, expect, it } from 'vitest';
import {
  chunkLevelToStratum,
  estimateChunkTokens,
  selectChunksWithinBudget,
} from '../../supabase/functions/_shared/retrieval-budget.js';

describe('retrieval-budget', () => {
  it('estimateChunkTokens uses a coarse chars-per-token heuristic', () => {
    expect(estimateChunkTokens('')).toBe(1);
    expect(estimateChunkTokens('abcd')).toBe(1);
    expect(estimateChunkTokens('a'.repeat(40))).toBe(10);
  });

  it('chunkLevelToStratum maps levels to KOS strata', () => {
    expect(chunkLevelToStratum('document')).toBe('state');
    expect(chunkLevelToStratum('section')).toBe('doctrine');
    expect(chunkLevelToStratum('paragraph')).toBe('specs');
    expect(chunkLevelToStratum('claim')).toBe('evidence');
  });

  it('selectChunksWithinBudget respects max_chunks without token cap', () => {
    const ranked = [
      { chunk_id: '1', content: 'a'.repeat(400), chunk_level: 'claim', composite_score: 0.9 },
      { chunk_id: '2', content: 'b'.repeat(400), chunk_level: 'claim', composite_score: 0.8 },
      { chunk_id: '3', content: 'c'.repeat(400), chunk_level: 'claim', composite_score: 0.7 },
    ];
    const { selected, skippedDueToTokenBudget } = selectChunksWithinBudget(ranked, { maxChunks: 2 });
    expect(selected).toHaveLength(2);
    expect(selected.map((c) => c.chunk_id)).toEqual(['1', '2']);
    expect(skippedDueToTokenBudget).toBe(0);
  });

  it('selectChunksWithinBudget drops chunks that exceed max_tokens', () => {
    const ranked = [
      { chunk_id: '1', content: 'a'.repeat(400), chunk_level: 'claim', composite_score: 0.9 },
      { chunk_id: '2', content: 'b'.repeat(400), chunk_level: 'claim', composite_score: 0.8 },
    ];
    const { selected, skippedDueToTokenBudget } = selectChunksWithinBudget(ranked, {
      maxChunks: 5,
      maxTokens: 100,
    });
    expect(estimateChunkTokens(ranked[0].content)).toBe(100);
    expect(selected).toHaveLength(1);
    expect(skippedDueToTokenBudget).toBe(1);
  });

  it('selectChunksWithinBudget allocates strata before global backfill', () => {
    const ranked = [
      { chunk_id: 'd', content: 'x'.repeat(20), chunk_level: 'document', composite_score: 0.5 },
      { chunk_id: 'c', content: 'x'.repeat(20), chunk_level: 'claim', composite_score: 0.99 },
      { chunk_id: 'p', content: 'x'.repeat(20), chunk_level: 'paragraph', composite_score: 0.6 },
    ];
    const { selected } = selectChunksWithinBudget(ranked, {
      maxChunks: 3,
      maxTokens: 500,
      strataWeights: { evidence: 0.9, state: 0.1 },
    });
    const ids = selected.map((c) => c.chunk_id);
    expect(ids).toContain('c');
    expect(ids).toContain('d');
  });
});
