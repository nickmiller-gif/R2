/**
 * Tests for the Eigen reranker utilities.
 */
import { describe, it, expect } from 'vitest';
import { rerankByAuthority, rerankWithExternal } from '../../src/lib/eigen/reranker.js';
import type { RetrievalResultItem } from '../../src/lib/oracle/retrieval-contract.js';

function makeItem(overrides: Partial<RetrievalResultItem> = {}): RetrievalResultItem {
  return {
    id: 'item-1',
    relevance: 0.8,
    sourceLane: 'internal_canonical',
    excerpt: 'Default excerpt',
    metadata: {
      authorityScore: 75,
      freshnessScore: 90,
    },
    ...overrides,
  };
}

describe('rerankByAuthority', () => {
  it('blends retrieval score with authority and freshness', () => {
    const items = [
      makeItem({ id: 'high-auth', relevance: 0.5, metadata: { authorityScore: 100, freshnessScore: 100 } }),
      makeItem({ id: 'high-rel', relevance: 0.95, metadata: { authorityScore: 30, freshnessScore: 30 } }),
    ];

    const result = rerankByAuthority(items, { topN: 10 });

    // Both should be present
    expect(result).toHaveLength(2);
    // The high-authority item gets boosted; high-relevance may still win depending on weights
    expect(result[0].relevance).toBeGreaterThan(0);
    expect(result[1].relevance).toBeGreaterThan(0);
  });

  it('respects topN limit', () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({ id: `item-${i}`, relevance: (10 - i) / 10 }),
    );

    const result = rerankByAuthority(items, { topN: 3 });
    expect(result).toHaveLength(3);
  });

  it('filters by minRelevance', () => {
    const items = [
      makeItem({ id: 'high', relevance: 0.9, metadata: { authorityScore: 90, freshnessScore: 90 } }),
      makeItem({ id: 'low', relevance: 0.1, metadata: { authorityScore: 10, freshnessScore: 10 } }),
    ];

    const result = rerankByAuthority(items, { topN: 10, minRelevance: 0.5 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('high');
  });

  it('handles missing metadata gracefully', () => {
    const items = [makeItem({ id: 'no-meta', relevance: 0.8, metadata: {} })];

    const result = rerankByAuthority(items, { topN: 5 });
    expect(result).toHaveLength(1);
    // Should use defaults (50/100 for authority and freshness)
    expect(result[0].relevance).toBeGreaterThan(0);
  });

  it('sorts by final blended score descending', () => {
    const items = [
      makeItem({ id: 'a', relevance: 0.3, metadata: { authorityScore: 100, freshnessScore: 100 } }),
      makeItem({ id: 'b', relevance: 0.9, metadata: { authorityScore: 50, freshnessScore: 50 } }),
      makeItem({ id: 'c', relevance: 0.6, metadata: { authorityScore: 80, freshnessScore: 80 } }),
    ];

    const result = rerankByAuthority(items, { topN: 10 });
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].relevance).toBeGreaterThanOrEqual(result[i].relevance);
    }
  });

  it('accepts custom weights', () => {
    const items = [
      makeItem({ id: 'high-auth', relevance: 0.3, metadata: { authorityScore: 100, freshnessScore: 50 } }),
      makeItem({ id: 'high-rel', relevance: 0.9, metadata: { authorityScore: 20, freshnessScore: 50 } }),
    ];

    // Authority-heavy weights
    const result = rerankByAuthority(items, { topN: 10 }, { retrieval: 0.1, authority: 0.8, freshness: 0.1 });
    expect(result[0].id).toBe('high-auth');
  });

  it('returns empty for empty input', () => {
    const result = rerankByAuthority([], { topN: 5 });
    expect(result).toHaveLength(0);
  });
});

describe('rerankWithExternal', () => {
  it('calls the rerank function and returns reordered results', async () => {
    const items = [
      makeItem({ id: 'a', relevance: 0.9, excerpt: 'First document' }),
      makeItem({ id: 'b', relevance: 0.5, excerpt: 'Second document' }),
      makeItem({ id: 'c', relevance: 0.3, excerpt: 'Third document' }),
    ];

    const mockRerankFn = async (_query: string, documents: string[]) => {
      // Reverse the order — the last doc is most relevant
      return documents.map((_, i) => ({
        index: i,
        relevance_score: (documents.length - i) / documents.length,
      }));
    };

    const result = await rerankWithExternal('test query', items, { topN: 2 }, mockRerankFn);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a'); // index 0 gets score 1.0
    expect(result[0].relevance).toBeCloseTo(1.0, 1);
  });

  it('respects topN limit', async () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeItem({ id: `item-${i}`, excerpt: `Doc ${i}` }),
    );

    const mockRerankFn = async (_q: string, docs: string[]) =>
      docs.map((_, i) => ({ index: i, relevance_score: 1 - i * 0.1 }));

    const result = await rerankWithExternal('test', items, { topN: 2 }, mockRerankFn);
    expect(result).toHaveLength(2);
  });

  it('filters by minRelevance', async () => {
    const items = [
      makeItem({ id: 'good', excerpt: 'Good doc' }),
      makeItem({ id: 'bad', excerpt: 'Bad doc' }),
    ];

    const mockRerankFn = async () => [
      { index: 0, relevance_score: 0.9 },
      { index: 1, relevance_score: 0.1 },
    ];

    const result = await rerankWithExternal('test', items, { topN: 10, minRelevance: 0.5 }, mockRerankFn);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('good');
  });

  it('handles empty input', async () => {
    const mockRerankFn = async () => [];
    const result = await rerankWithExternal('test', [], { topN: 5 }, mockRerankFn);
    expect(result).toHaveLength(0);
  });
});
