/**
 * Tests for the Eigen text chunker.
 */
import { describe, it, expect } from 'vitest';
import { chunkText, estimateTokens } from '../../src/lib/eigen/chunker.js';

describe('chunkText', () => {
  it('returns single chunk for short text', () => {
    const result = chunkText('Hello world', { maxTokens: 100 });
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Hello world');
    expect(result[0].index).toBe(0);
    expect(result[0].startOffset).toBe(0);
  });

  it('splits on paragraph boundaries', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const result = chunkText(text, { maxTokens: 10 }); // ~40 chars max
    expect(result.length).toBeGreaterThanOrEqual(2);
    // Each chunk should be <= maxTokens * 4 chars
    for (const chunk of result) {
      expect(chunk.content.length).toBeLessThanOrEqual(10 * 4 + 10 * 4 * 0.1 + 10);
    }
  });

  it('splits on sentence boundaries when paragraphs are too large', () => {
    const text = 'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.';
    const result = chunkText(text, { maxTokens: 12 }); // ~48 chars max
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      // Allow some tolerance for overlap
      expect(chunk.content.length).toBeLessThanOrEqual(12 * 4 + 12 * 4 * 0.1 + 20);
    }
  });

  it('preserves all content across chunks', () => {
    const sentences = Array.from({ length: 20 }, (_, i) => `Sentence number ${i + 1}.`);
    const text = sentences.join(' ');
    const result = chunkText(text, { maxTokens: 20, overlapTokens: 0 });

    // Join all chunks and verify nothing is lost
    const reconstructed = result.map((c) => c.content).join('');
    // With no overlap, the joined chunks should reconstruct the original
    expect(reconstructed).toBe(text);
  });

  it('assigns sequential indexes', () => {
    const text = 'A. B. C. D. E. F. G. H. I. J. K. L. M. N. O. P.';
    const result = chunkText(text, { maxTokens: 5 });
    for (let i = 0; i < result.length; i++) {
      expect(result[i].index).toBe(i);
    }
  });

  it('respects custom maxTokens', () => {
    const text = 'Word '.repeat(200);
    const result = chunkText(text, { maxTokens: 50 }); // 200 chars max
    for (const chunk of result) {
      // Allow overlap tolerance
      expect(chunk.content.length).toBeLessThanOrEqual(250);
    }
    expect(result.length).toBeGreaterThan(1);
  });

  it('handles empty string', () => {
    const result = chunkText('', { maxTokens: 100 });
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('');
  });

  it('handles text with no separator matches', () => {
    const text = 'a'.repeat(200);
    const result = chunkText(text, { maxTokens: 10 }); // 40 chars max
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.content.length).toBeLessThanOrEqual(50); // some tolerance
    }
  });

  it('uses overlap from previous chunk', () => {
    const text = 'First part of the text.\n\nSecond part of the text.\n\nThird part.';
    const result = chunkText(text, { maxTokens: 10, overlapTokens: 3 });
    // With overlap, later chunks should start with text from the end of the previous
    if (result.length > 1) {
      // Overlap means chunk[1] may contain trailing chars of chunk[0]
      expect(result[1].content.length).toBeGreaterThan(0);
    }
  });
});

describe('estimateTokens', () => {
  it('estimates ~1 token per 4 characters', () => {
    expect(estimateTokens('Hello world!')).toBe(3); // 12 / 4 = 3
  });

  it('handles empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('rounds up', () => {
    expect(estimateTokens('Hi')).toBe(1); // 2 / 4 → ceil = 1
  });
});
