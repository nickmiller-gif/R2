import { describe, expect, it } from 'vitest';
import {
  isOpenAiVectorRetrievalEnabled,
  mergePromptRetrievalChunks,
  openAiCorpusHitsToPromptChunks,
  resolveChatRetrievalMerge,
} from '../../src/lib/eigen/openai-corpus-retrieval.ts';

describe('isOpenAiVectorRetrievalEnabled', () => {
  it('is true only for the literal "true"', () => {
    expect(isOpenAiVectorRetrievalEnabled('true')).toBe(true);
    expect(isOpenAiVectorRetrievalEnabled(' TRUE ')).toBe(false);
    expect(isOpenAiVectorRetrievalEnabled('1')).toBe(false);
    expect(isOpenAiVectorRetrievalEnabled(undefined)).toBe(false);
  });
});

describe('openAiCorpusHitsToPromptChunks', () => {
  it('skips hits without snippet text', () => {
    expect(
      openAiCorpusHitsToPromptChunks([
        { fileId: 'f1', score: 0.9 },
        { snippet: '   ', score: 0.8 },
      ]),
    ).toEqual([]);
  });

  it('maps document_id and source metadata from attributes', () => {
    const [chunk] = openAiCorpusHitsToPromptChunks([
      {
        fileId: 'file-abc',
        filename: 'doc.md',
        documentId: 'doc-uuid',
        score: 0.77,
        snippet: 'Passage text here.',
        attributes: { source_system: 'real_estate' },
      },
    ]);
    expect(chunk.content).toBe('Passage text here.');
    expect(chunk.composite_score).toBe(0.77);
    expect(chunk.provenance?.document_id).toBe('doc-uuid');
    expect(chunk.provenance?.source_system).toBe('real_estate');
    expect(chunk.provenance?.source_ref).toBe('doc.md');
  });

  it('clamps out-of-range scores', () => {
    const [high, low] = openAiCorpusHitsToPromptChunks([
      { snippet: 'a', score: 2 },
      { snippet: 'b', score: -1 },
    ]);
    expect(high.composite_score).toBe(1);
    expect(low.composite_score).toBe(0);
  });
});

describe('mergePromptRetrievalChunks', () => {
  it('returns primary unchanged when OpenAI list is empty', () => {
    const primary = [{ content: 'pg', composite_score: 0.9 }];
    expect(mergePromptRetrievalChunks(primary, [])).toBe(primary);
  });

  it('appends OpenAI chunks after primary', () => {
    const merged = mergePromptRetrievalChunks(
      [{ content: 'primary', composite_score: 0.9 }],
      [{ content: 'openai', composite_score: 0.7 }],
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].content).toBe('primary');
    expect(merged[1].content).toBe('openai');
  });
});

describe('resolveChatRetrievalMerge', () => {
  it('merges when pgvector succeeds', () => {
    const out = resolveChatRetrievalMerge({
      retrieveOk: true,
      primaryChunks: [{ content: 'pg', composite_score: 0.8 }],
      openAiChunks: [{ content: 'oai', composite_score: 0.7 }],
    });
    expect(out.ok).toBe(true);
    expect(out.pgvectorDegraded).toBeUndefined();
    expect(out.chunks.map((c) => c.content)).toEqual(['pg', 'oai']);
  });

  it('falls back to OpenAI corpus when pgvector fails', () => {
    const out = resolveChatRetrievalMerge({
      retrieveOk: false,
      retrieveMessage: 'statement timeout',
      primaryChunks: [],
      openAiChunks: [{ content: 'oai only', composite_score: 0.6 }],
    });
    expect(out.ok).toBe(true);
    expect(out.pgvectorDegraded).toBe(true);
    expect(out.chunks).toHaveLength(1);
  });

  it('fails when both sources are empty', () => {
    const out = resolveChatRetrievalMerge({
      retrieveOk: false,
      retrieveMessage: 'statement timeout',
      primaryChunks: [],
      openAiChunks: [],
    });
    expect(out.ok).toBe(false);
    expect(out.message).toContain('timeout');
  });
});
