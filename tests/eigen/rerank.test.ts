import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_RERANK_CONFIG,
  fuseRerankScores,
  resolveRerankConfig,
  runRerankerWithTimeout,
  selectRerankBatch,
  type RerankableCandidate,
  type RerankerPort,
  type RerankInput,
  type RerankOutput,
} from '../../src/lib/eigen/rerank.js';

function candidate(
  chunk_id: string,
  composite_score: number,
  content = chunk_id,
): RerankableCandidate {
  return { chunk_id, composite_score, content };
}

describe('resolveRerankConfig', () => {
  it('returns defaults when nothing overridden', () => {
    expect(resolveRerankConfig(undefined)).toEqual(DEFAULT_RERANK_CONFIG);
    expect(resolveRerankConfig({})).toEqual(DEFAULT_RERANK_CONFIG);
  });

  it('clamps top_k to [1, 200]', () => {
    expect(resolveRerankConfig({ top_k: 0 }).top_k).toBe(1);
    expect(resolveRerankConfig({ top_k: 1_000 }).top_k).toBe(200);
    expect(resolveRerankConfig({ top_k: 25 }).top_k).toBe(25);
  });

  it('clamps blend_weight to [0, 1]', () => {
    expect(resolveRerankConfig({ blend_weight: -1 }).blend_weight).toBe(0);
    expect(resolveRerankConfig({ blend_weight: 5 }).blend_weight).toBe(1);
    expect(resolveRerankConfig({ blend_weight: 0.25 }).blend_weight).toBe(0.25);
  });

  it('clamps timeout to [50, 5000]', () => {
    expect(resolveRerankConfig({ timeout_ms: 10 }).timeout_ms).toBe(50);
    expect(resolveRerankConfig({ timeout_ms: 9_999 }).timeout_ms).toBe(5_000);
    expect(resolveRerankConfig({ timeout_ms: 250 }).timeout_ms).toBe(250);
  });

  it('falls back when value is not finite', () => {
    expect(resolveRerankConfig({ top_k: Number.NaN }).top_k).toBe(DEFAULT_RERANK_CONFIG.top_k);
    expect(resolveRerankConfig({ blend_weight: Number.POSITIVE_INFINITY }).blend_weight).toBe(
      DEFAULT_RERANK_CONFIG.blend_weight,
    );
  });
});

describe('selectRerankBatch', () => {
  it('returns the first top_k candidates', () => {
    const candidates = [candidate('a', 0.9), candidate('b', 0.8), candidate('c', 0.7)];
    expect(selectRerankBatch(candidates, 2).map((c) => c.chunk_id)).toEqual(['a', 'b']);
  });

  it('returns all candidates when top_k exceeds length', () => {
    const candidates = [candidate('a', 0.9), candidate('b', 0.8)];
    expect(selectRerankBatch(candidates, 50)).toHaveLength(2);
  });

  it('returns [] when top_k is non-positive or list empty', () => {
    expect(selectRerankBatch([candidate('a', 1)], 0)).toEqual([]);
    expect(selectRerankBatch([], 10)).toEqual([]);
  });
});

describe('fuseRerankScores', () => {
  it('reorders candidates so a strongly reranked one floats to the top', () => {
    const candidates = [candidate('a', 0.9), candidate('b', 0.8), candidate('c', 0.7)];
    const scores = [
      { chunk_id: 'a', rerank_score: 0.1 },
      { chunk_id: 'b', rerank_score: 0.95 },
      { chunk_id: 'c', rerank_score: 0.4 },
    ];

    const result = fuseRerankScores(candidates, scores, 1.0);
    expect(result.candidates.map((c) => c.chunk_id)).toEqual(['b', 'c', 'a']);
    expect(result.reranked_count).toBe(3);
    expect(result.reorder_distance).toBeGreaterThan(0);
  });

  it('keeps original order when blend_weight is 0', () => {
    const candidates = [candidate('a', 0.9), candidate('b', 0.8), candidate('c', 0.7)];
    const scores = [
      { chunk_id: 'a', rerank_score: 0.0 },
      { chunk_id: 'b', rerank_score: 1.0 },
      { chunk_id: 'c', rerank_score: 0.5 },
    ];
    const result = fuseRerankScores(candidates, scores, 0);
    expect(result.candidates.map((c) => c.chunk_id)).toEqual(['a', 'b', 'c']);
    expect(result.reorder_distance).toBe(0);
  });

  it('leaves candidates without a rerank score at their composite_score', () => {
    const candidates = [candidate('a', 0.9), candidate('b', 0.4), candidate('c', 0.3)];
    const scores = [{ chunk_id: 'b', rerank_score: 0.99 }];
    const result = fuseRerankScores(candidates, scores, 0.5);

    const byId = new Map(result.candidates.map((c) => [c.chunk_id, c]));
    expect(byId.get('a')?.rerank_score).toBeNull();
    expect(byId.get('a')?.fused_score).toBeCloseTo(0.9);
    expect(byId.get('c')?.rerank_score).toBeNull();
    expect(byId.get('c')?.fused_score).toBeCloseTo(0.3);
    expect(byId.get('b')?.rerank_score).toBeCloseTo(0.99);
  });

  it('ignores non-finite rerank scores', () => {
    const candidates = [candidate('a', 0.5)];
    const scores = [{ chunk_id: 'a', rerank_score: Number.NaN }];
    const result = fuseRerankScores(candidates, scores, 1.0);
    expect(result.candidates[0]?.rerank_score).toBeNull();
    expect(result.reranked_count).toBe(0);
  });

  it('clamps an out-of-range blend_weight to [0, 1]', () => {
    const candidates = [candidate('a', 0.2), candidate('b', 0.1)];
    const scores = [
      { chunk_id: 'a', rerank_score: 0.0 },
      { chunk_id: 'b', rerank_score: 1.0 },
    ];
    const result = fuseRerankScores(candidates, scores, 5);
    expect(result.candidates[0]?.chunk_id).toBe('b');
  });
});

describe('runRerankerWithTimeout', () => {
  const sampleInput: RerankInput = {
    query: 'hello',
    documents: [{ chunk_id: 'a', content: 'a' }],
  };

  it('returns the reranker output on success', async () => {
    const port: RerankerPort = {
      rerank: vi.fn().mockResolvedValue({
        scores: [{ chunk_id: 'a', rerank_score: 0.7 }],
        model: 'test',
        latency_ms: 5,
      } satisfies RerankOutput),
    };
    const result = await runRerankerWithTimeout(port, sampleInput, 100);
    expect(result?.scores).toHaveLength(1);
  });

  it('returns null when the call throws', async () => {
    const port: RerankerPort = {
      rerank: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const result = await runRerankerWithTimeout(port, sampleInput, 100);
    expect(result).toBeNull();
  });

  it('returns null when the call exceeds the timeout', async () => {
    const port: RerankerPort = {
      rerank: () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                scores: [{ chunk_id: 'a', rerank_score: 1 }],
                model: 't',
                latency_ms: 999,
              }),
            200,
          );
        }),
    };
    const result = await runRerankerWithTimeout(port, sampleInput, 50);
    expect(result).toBeNull();
  });

  it('returns null when the reranker returns empty scores', async () => {
    const port: RerankerPort = {
      rerank: vi.fn().mockResolvedValue({ scores: [], model: 'empty', latency_ms: 1 }),
    };
    const result = await runRerankerWithTimeout(port, sampleInput, 100);
    expect(result).toBeNull();
  });
});
