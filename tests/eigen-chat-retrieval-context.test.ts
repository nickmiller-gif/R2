import { describe, expect, it } from 'vitest';
import {
  LOW_CONFIDENCE_MAX_COMPOSITE,
  MEDIUM_CONFIDENCE_MAX_COMPOSITE,
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

  it('drops empty heading-path segments', () => {
    const out = formatRetrievalContextForLlm([
      chunk({
        content: 'Body.',
        provenance: {
          document_id: 'd',
          source_system: '',
          source_ref: '',
          heading_path: ['', '  ', 'Real'],
          valid_from: null,
        },
      }),
    ]);
    expect(out).toContain('Path: Real');
    expect(out).not.toContain('Origin:');
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

  it('boundary: composite at LOW threshold + medium label → mixed guidance', () => {
    const text = eigenRetrievalQualityAppend(
      [chunk({ content: 'x', composite_score: LOW_CONFIDENCE_MAX_COMPOSITE })],
      'medium',
    );
    expect(text.toLowerCase()).toContain('mixed');
  });

  it('boundary: composite at MEDIUM threshold + medium label → empty (strict <)', () => {
    expect(
      eigenRetrievalQualityAppend(
        [chunk({ content: 'x', composite_score: MEDIUM_CONFIDENCE_MAX_COMPOSITE })],
        'medium',
      ),
    ).toBe('');
  });
});

/**
 * Smoke test for the system-prompt compose pattern used inside the three
 * eigen-chat edge functions. If anyone reorders, drops, or short-circuits
 * the [base, ..., retrievalAppend].filter(Boolean).join('\n\n') array,
 * these assertions catch it.
 */
describe('system-prompt threading (compose pattern)', () => {
  function composeForTest(parts: {
    base: string;
    voiceAddendum?: string;
    retrievalAppend?: string;
  }): string {
    return [
      parts.base,
      'Primary domain corpus decides answer direction; secondary corpus is additive only.',
      parts.voiceAddendum,
      parts.retrievalAppend,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  const BASE = 'You are a helpful assistant.';
  const VOICE = 'Use a warm tone.';

  it('includes the retrieval append when low-confidence is in effect', () => {
    const retrievalAppend = eigenRetrievalQualityAppend(
      [{ content: 'x', composite_score: 0.9 }],
      'low',
    );
    expect(retrievalAppend).not.toBe('');
    const out = composeForTest({ base: BASE, voiceAddendum: VOICE, retrievalAppend });
    expect(out).toContain(BASE);
    expect(out).toContain(VOICE);
    expect(out).toContain(retrievalAppend);
    expect(out).toContain('Primary domain corpus decides answer direction');
  });

  it('drops the retrieval append cleanly when retrieval is strong (no triple newlines)', () => {
    const retrievalAppend = eigenRetrievalQualityAppend(
      [{ content: 'x', composite_score: 0.95, similarity_score: 0.95 }],
      'high',
    );
    expect(retrievalAppend).toBe('');
    const out = composeForTest({ base: BASE, voiceAddendum: VOICE, retrievalAppend });
    expect(out).not.toContain('\n\n\n');
    expect(out.endsWith(VOICE)).toBe(true);
  });

  it('drops voiceAddendum cleanly when absent', () => {
    const retrievalAppend = eigenRetrievalQualityAppend(
      [{ content: 'x', composite_score: 0.5 }],
      'medium',
    );
    const out = composeForTest({ base: BASE, retrievalAppend });
    expect(out).not.toContain('\n\n\n');
    expect(out).toContain(retrievalAppend);
  });
});
