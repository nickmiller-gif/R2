import { describe, expect, it } from 'vitest';
import {
  eigenRetrievalQualityAppend,
  formatRetrievalContextForLlm,
  type ChatRetrievalChunkForPrompt,
} from '../src/lib/eigen/chat-retrieval-context.ts';

function chunk(
  partial: Partial<ChatRetrievalChunkForPrompt> & Pick<ChatRetrievalChunkForPrompt, 'content'>,
): ChatRetrievalChunkForPrompt {
  return {
    composite_score: 0.5,
    similarity_score: 0.5,
    ...partial,
  };
}

describe('formatRetrievalContextForLlm', () => {
  it('includes path and origin when provenance is present', () => {
    const out = formatRetrievalContextForLlm([
      chunk({
        content: 'Body text.',
        provenance: {
          document_id: 'd1',
          source_system: 'oracle_operator',
          source_ref: 'doc/1',
          heading_path: ['A', 'B'],
          valid_from: null,
        },
      }),
    ]);
    expect(out).toContain('[1]');
    expect(out).toContain('Path: A › B');
    expect(out).toContain('Origin: oracle_operator · doc/1');
    expect(out).toContain('Body text.');
  });

  it('separates multiple chunks with a rule line', () => {
    const out = formatRetrievalContextForLlm([
      chunk({
        content: 'One',
        provenance: {
          document_id: 'd',
          source_system: 's',
          source_ref: 'r',
          heading_path: [],
          valid_from: null,
        },
      }),
      chunk({ content: 'Two' }),
    ]);
    expect(out).toContain('\n\n---\n\n');
    expect(out).toContain('Two');
  });
});

describe('eigenRetrievalQualityAppend', () => {
  it('returns empty when there are no chunks', () => {
    expect(eigenRetrievalQualityAppend([], 'high')).toBe('');
  });

  it('adds caution when overall confidence is low', () => {
    const text = eigenRetrievalQualityAppend(
      [chunk({ content: 'x', composite_score: 0.9 })],
      'low',
    );
    expect(text.length).toBeGreaterThan(20);
    expect(text.toLowerCase()).toContain('limited');
  });

  it('adds mixed guidance for medium with weak max composite', () => {
    const text = eigenRetrievalQualityAppend(
      [chunk({ content: 'x', composite_score: 0.5, similarity_score: 0.5 })],
      'medium',
    );
    expect(text.toLowerCase()).toContain('mixed');
  });

  it('returns empty for strong medium retrieval', () => {
    expect(
      eigenRetrievalQualityAppend(
        [chunk({ content: 'x', composite_score: 0.85, similarity_score: 0.85 })],
        'medium',
      ),
    ).toBe('');
  });
});
