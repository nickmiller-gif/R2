import { describe, expect, it } from 'vitest';
import {
  buildCuratorDocumentTags,
  buildCuratorSummaryLine,
  buildEmbeddingPrefixFromCuratorMetadata,
} from '../../src/lib/eigen/eigen-curator-metadata';

describe('buildCuratorDocumentTags', () => {
  it('maps topics domain audience lane', () => {
    const tags = buildCuratorDocumentTags({
      curator_topics: ['Pricing', 'Hospitality'],
      content_domain: 'Retreat Ops',
      audience: 'Operators',
      corpus_lane: 'Manual upload',
    });
    expect(tags).toContain('topic:pricing');
    expect(tags).toContain('topic:hospitality');
    expect(tags).toContain('domain:retreat-ops');
    expect(tags).toContain('audience:operators');
    expect(tags).toContain('lane:manual-upload');
  });

  it('parses comma-separated topics string', () => {
    const tags = buildCuratorDocumentTags({ curator_topics: 'alpha, beta' });
    expect(tags).toEqual(['topic:alpha', 'topic:beta']);
  });

  it('returns empty for empty metadata', () => {
    expect(buildCuratorDocumentTags(undefined)).toEqual([]);
    expect(buildCuratorDocumentTags({})).toEqual([]);
  });
});

describe('buildEmbeddingPrefixFromCuratorMetadata', () => {
  it('prefixes when tags exist', () => {
    const p = buildEmbeddingPrefixFromCuratorMetadata({ curator_topics: ['x'] });
    expect(p.startsWith('[Curator corpus labels:')).toBe(true);
    expect(p.includes('topic:x')).toBe(true);
    expect(p.endsWith('\n\n')).toBe(true);
  });

  it('is empty without tags', () => {
    expect(buildEmbeddingPrefixFromCuratorMetadata({ foo: 1 })).toBe('');
  });
});

describe('buildCuratorSummaryLine', () => {
  it('joins tags for human scan', () => {
    expect(buildCuratorSummaryLine({ curator_topics: ['a'] })).toMatch(/^Curator: topic:a$/);
  });
});
