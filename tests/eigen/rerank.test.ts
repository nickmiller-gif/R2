import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_RERANK_CONFIG,
  DEFAULT_RERANK_LIMITS,
  classifyRerankerHttpStatus,
  formatRerankerError,
  fuseRerankScores,
  prepareRerankRequest,
  resolveRerankConfig,
  resolveRerankPayloadLimits,
  runRerankerWithTimeout,
  selectRerankBatch,
  truncateForRerank,
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

  it('aborts the input signal when the timeout fires', async () => {
    let receivedSignal: AbortSignal | undefined;
    const port: RerankerPort = {
      rerank: (input) =>
        new Promise((_resolve, reject) => {
          receivedSignal = input.signal;
          input.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        }),
    };

    const result = await runRerankerWithTimeout(port, sampleInput, 50);
    expect(result).toBeNull();
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('does not surface a late rejection as an unhandled error', async () => {
    let rejectLater: ((err: Error) => void) | undefined;
    const port: RerankerPort = {
      rerank: () =>
        new Promise((_resolve, reject) => {
          rejectLater = reject;
        }),
    };

    const unhandled: unknown[] = [];
    const handler = (err: unknown) => unhandled.push(err);
    process.on('unhandledRejection', handler);
    try {
      const result = await runRerankerWithTimeout(port, sampleInput, 30);
      expect(result).toBeNull();

      rejectLater?.(new Error('late failure'));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', handler);
    }
  });
});

describe('resolveRerankPayloadLimits', () => {
  it('returns defaults when nothing overridden', () => {
    expect(resolveRerankPayloadLimits(undefined)).toEqual(DEFAULT_RERANK_LIMITS);
    expect(resolveRerankPayloadLimits({})).toEqual(DEFAULT_RERANK_LIMITS);
  });

  it('clamps both limits within their safety ranges', () => {
    expect(resolveRerankPayloadLimits({ max_query_chars: 0 }).max_query_chars).toBe(16);
    expect(resolveRerankPayloadLimits({ max_query_chars: 1_000_000 }).max_query_chars).toBe(32_000);
    expect(resolveRerankPayloadLimits({ max_document_chars: 0 }).max_document_chars).toBe(64);
    expect(resolveRerankPayloadLimits({ max_document_chars: 1_000_000 }).max_document_chars).toBe(
      200_000,
    );
  });

  it('falls back to defaults on non-finite values', () => {
    const limits = resolveRerankPayloadLimits({
      max_query_chars: Number.NaN,
      max_document_chars: Number.POSITIVE_INFINITY,
    });
    expect(limits).toEqual(DEFAULT_RERANK_LIMITS);
  });
});

describe('truncateForRerank', () => {
  it('returns the string unchanged when within budget', () => {
    expect(truncateForRerank('hello', 100)).toBe('hello');
  });

  it('truncates oversized strings to the cap', () => {
    const text = 'x'.repeat(50);
    expect(truncateForRerank(text, 10)).toBe('xxxxxxxxxx');
  });

  it('does not split a surrogate pair at the cut point', () => {
    // '😀' is U+1F600, encoded as the surrogate pair 0xD83D 0xDE00 in UTF-16.
    // Slicing at length=1 would leave a lone high surrogate; the helper must
    // drop it instead of emitting an invalid UTF-16 sequence.
    const text = 'a😀b';
    const truncated = truncateForRerank(text, 2);
    expect(truncated).toBe('a');
  });

  it('returns empty when maxChars is non-positive or input is not a string', () => {
    expect(truncateForRerank('abc', 0)).toBe('');
    expect(truncateForRerank('abc', -5)).toBe('');
    expect(truncateForRerank(undefined as unknown as string, 10)).toBe('');
  });
});

describe('prepareRerankRequest', () => {
  it('truncates query and per-document content to configured limits', () => {
    const result = prepareRerankRequest(
      {
        query: 'q'.repeat(100),
        documents: [{ chunk_id: 'a', content: 'c'.repeat(100) }],
      },
      { max_query_chars: 10, max_document_chars: 20 },
    );
    expect(result).not.toBeNull();
    expect(result?.query.length).toBe(10);
    expect(result?.documents[0]?.content.length).toBe(20);
  });

  it('returns null when the query trims to empty', () => {
    const result = prepareRerankRequest({
      query: '   \n\t  ',
      documents: [{ chunk_id: 'a', content: 'real content' }],
    });
    expect(result).toBeNull();
  });

  it('drops documents with empty or whitespace-only content', () => {
    const result = prepareRerankRequest({
      query: 'hello',
      documents: [
        { chunk_id: 'a', content: '   ' },
        { chunk_id: 'b', content: 'real' },
        { chunk_id: 'c', content: '' },
      ],
    });
    expect(result?.documents.map((d) => d.chunk_id)).toEqual(['b']);
  });

  it('returns null when every document filters out (skip the API call)', () => {
    const result = prepareRerankRequest({
      query: 'hello',
      documents: [
        { chunk_id: 'a', content: '' },
        { chunk_id: 'b', content: '   ' },
      ],
    });
    expect(result).toBeNull();
  });

  it('drops malformed document rows', () => {
    const result = prepareRerankRequest({
      query: 'hello',
      documents: [{ chunk_id: '', content: 'real' } as never, { chunk_id: 'b', content: 'real' }],
    });
    expect(result?.documents.map((d) => d.chunk_id)).toEqual(['b']);
  });
});

describe('classifyRerankerHttpStatus', () => {
  it('returns stable kinds for the common provider failure modes', () => {
    expect(classifyRerankerHttpStatus(401)).toBe('unauthorized');
    expect(classifyRerankerHttpStatus(403)).toBe('forbidden');
    expect(classifyRerankerHttpStatus(404)).toBe('not_found');
    expect(classifyRerankerHttpStatus(429)).toBe('rate_limited');
    expect(classifyRerankerHttpStatus(503)).toBe('server_error');
    expect(classifyRerankerHttpStatus(400)).toBe('bad_request');
    expect(classifyRerankerHttpStatus(418)).toBe('bad_request');
    expect(classifyRerankerHttpStatus(0)).toBe('http_error');
  });
});

describe('formatRerankerError', () => {
  it('produces a classified, bounded error message', () => {
    const err = formatRerankerError('voyage', 429, 'too many requests, slow down', 12);
    expect(err.message).toBe('reranker_rate_limited: provider=voyage status=429: too many req');
  });

  it('collapses whitespace and caps body length', () => {
    const longBody = 'line one\nline two\t\t   line three '.repeat(20);
    const err = formatRerankerError('cohere', 500, longBody);
    expect(err.message.startsWith('reranker_server_error: provider=cohere status=500: ')).toBe(
      true,
    );
    // 256 default cap + the static prefix shape; the body suffix must not contain newlines.
    expect(err.message).not.toContain('\n');
    expect(err.message).not.toContain('\t');
  });

  it('omits the suffix when the body is empty', () => {
    expect(formatRerankerError('voyage', 401, '').message).toBe(
      'reranker_unauthorized: provider=voyage status=401',
    );
  });

  it('tolerates a non-string body', () => {
    const err = formatRerankerError('voyage', 500, undefined as unknown as string);
    expect(err.message).toBe('reranker_server_error: provider=voyage status=500');
  });
});
